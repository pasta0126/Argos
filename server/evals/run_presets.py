"""Run every preset over the labelled texts in presets.jsonl and report accuracy per question.

Loads the real model, so run it inside the image (command in server/README.md). A report, not
a gate: it always exits 0 and marks questions whose balanced accuracy (mean recall per expected
class, so answering the majority class everywhere does not score well) is under 80 %.

    python evals/run_presets.py [--preset NAME] [--misses]

--misses prints the tuning texts each question got wrong (held-out misses stay hidden, so
rewording is not tuned to them).
"""

import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from argos_api.laya_engine import LayaEngine  # noqa: E402
from argos_api.presets import PRESETS  # noqa: E402

BAR = 0.80
EVAL_SET = Path(__file__).resolve().parent / "presets.jsonl"


def answer_value(question, answer):
    if question.type == "choice":
        return answer["choice"]
    if question.type == "score":
        return question.criteria.index(answer["level"])
    return answer["answer"]


def pct(hits: int, n: int) -> str:
    return f"{hits}/{n} ({hits / n:.0%})" if n else "-"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset", choices=sorted(PRESETS))
    parser.add_argument("--misses", action="store_true")
    args = parser.parse_args()

    rows = [json.loads(line) for line in EVAL_SET.read_text().splitlines() if line.strip()]
    rows = [r for r in rows if r["preset"] in PRESETS and (not args.preset or r["preset"] == args.preset)]

    engine = LayaEngine(revision=os.environ.get("ARGOS_MODEL_REVISION", ""), threads=int(os.environ.get("ARGOS_THREADS", "3")))
    engine.load()
    print(f"model {engine.model_name} revision {os.environ.get('ARGOS_MODEL_REVISION') or 'latest'}, {len(rows)} texts\n")

    # (preset, question) -> [(expected, got, split)]
    results = defaultdict(list)
    misses = defaultdict(list)
    for row in rows:
        preset = PRESETS[row["preset"]]
        answers = engine.decide(row["text"], preset.questions, None)
        split = "holdout" if row["holdout"] else "tune"
        for name, expected in row["expected"].items():
            got = answer_value(preset.questions[name], answers[name])
            results[(row["preset"], name)].append((expected, got, split))
            if got != expected and split == "tune":
                misses[(row["preset"], name)].append(f"expected={expected} got={got} ({answers[name]['confidence']:.2f}): {row['text'][:80]!r}")

    below = []
    print(f"{'preset':<11}{'question':<19}{'tuning':<14}{'held-out':<14}{'total':<14}{'balanced':<10}per class")
    for key, res in sorted(results.items()):
        preset, name = key
        hits = {split: sum(e == g for e, g, sp in res if sp == split) for split in ("tune", "holdout")}
        ns = {split: sum(sp == split for _, _, sp in res) for split in ("tune", "holdout")}
        per_class = {}
        for cls in sorted({e for e, _, _ in res}, key=str):
            got_cls = [g for e, g, _ in res if e == cls]
            per_class[cls] = (sum(g == cls for g in got_cls), len(got_cls))
        balanced = sum(h / n for h, n in per_class.values()) / len(per_class)
        mark = "" if balanced >= BAR else "  < 80%"
        if mark:
            below.append(f"{preset}.{name}")
        classes = " ".join(f"{c}:{h}/{n}" for c, (h, n) in per_class.items())
        total = pct(hits["tune"] + hits["holdout"], ns["tune"] + ns["holdout"])
        print(f"{preset:<11}{name:<19}{pct(hits['tune'], ns['tune']):<14}{pct(hits['holdout'], ns['holdout']):<14}{total:<14}{balanced:<10.0%}{classes}{mark}")
        if args.misses:
            for m in misses[key]:
                print(f"    {m}")

    print(f"\n{len(below)} of {len(results)} questions under 80 % balanced accuracy" + (f": {', '.join(below)}" if below else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
