"""Ask both oracles every question in oracle.jsonl and report how their answers are spread.

Loads the real model, so run it inside the image (command in server/README.md). A report, not
a gate: there are no expected answers (an oracle has no right answer), and it always exits 0.
It shows whether an oracle says the same thing to everything: the share of yes answers and the
P(yes) quartiles for the yes/no oracle, and how often each 8-Ball phrase and class wins.

    python evals/run_oracle.py [--wording default|alt] [--oracle yesno|8ball]

--wording asks with the alternative instruction in argos_api/oracle.py, to compare wordings.
"""

import argparse
import json
import os
import statistics
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from argos_api.laya_engine import LayaEngine  # noqa: E402
from argos_api.oracle import (  # noqa: E402
    EIGHTBALL_WORDINGS,
    KINDS,
    PHRASES,
    QUESTION_NAME,
    eightball_answer,
    eightball_question,
    yesno_answer,
    yesno_question,
)

EVAL_SET = Path(__file__).resolve().parent / "oracle.jsonl"


def load_rows() -> list[dict]:
    return [json.loads(line) for line in EVAL_SET.read_text().splitlines() if line.strip()]


def quartiles(values: list[float]) -> str:
    q1, q2, q3 = statistics.quantiles(values, n=4, method="inclusive")
    return f"min {min(values):.2f}  q1 {q1:.2f}  median {q2:.2f}  q3 {q3:.2f}  max {max(values):.2f}"


def report_yesno(engine, rows, wording) -> None:
    question = yesno_question(wording)
    print(f"yes/no oracle: {question.instructions!r}")
    results = [(row, yesno_answer(engine.decide(row["question"], {QUESTION_NAME: question}, None)[QUESTION_NAME])) for row in rows]
    for label, subset in (("yes/no questions", [r for r in results if not r[0]["open"]]), ("open questions", [r for r in results if r[0]["open"]])):
        if not subset:
            continue
        yes = sum(a["answer"] for _, a in subset)
        print(f"  {label:<17} yes {yes}/{len(subset)} ({yes / len(subset):.0%})  P(yes) {quartiles([a['probability'] for _, a in subset])}")
    for row, a in results:
        print(f"    {'sí' if a['answer'] else 'no'} {a['probability']:.2f}  {row['question']}")
    print()


def report_8ball(engine, rows, wording) -> None:
    question = eightball_question(wording)
    print(f"8-Ball oracle: {question.instructions!r}")
    wins, kinds, top = Counter(), Counter(), []
    for row in rows:
        a = eightball_answer(engine.decide(row["question"], {QUESTION_NAME: question}, None)[QUESTION_NAME])
        wins[a["answer"]] += 1
        kinds[a["kind"]] += 1
        winner = max(p["percentage"] for p in a["phrases"])
        top.append(winner)
        totals = "  ".join(f"{k[:3]} {a['totals'][k]:5.1f}" for k in KINDS)
        print(f"    {winner:5.1f}% {a['answer']:<40} {totals}  {row['question']}")
    n = len(rows)
    print(f"  wins per class: " + "  ".join(f"{k} {kinds[k]}/{n}" for k in KINDS))
    print(f"  winning phrase share: {quartiles(top)}")
    print(f"  {len(wins)} of {len(PHRASES)} phrases ever win:")
    for phrase, kind in PHRASES:
        print(f"    {wins[phrase]:>3}  {kind:<14} {phrase}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wording", choices=sorted(EIGHTBALL_WORDINGS), default="default")
    parser.add_argument("--oracle", choices=["yesno", "8ball"])
    args = parser.parse_args()

    rows = load_rows()
    engine = LayaEngine(revision=os.environ.get("ARGOS_MODEL_REVISION", ""), threads=int(os.environ.get("ARGOS_THREADS", "3")))
    engine.load()
    opened = sum(r["open"] for r in rows)
    print(f"model {engine.model_name} revision {os.environ.get('ARGOS_MODEL_REVISION') or 'latest'}, "
          f"{len(rows)} questions ({opened} open), wording {args.wording}\n")
    if args.oracle in (None, "yesno"):
        report_yesno(engine, rows, args.wording)
    if args.oracle in (None, "8ball"):
        report_8ball(engine, rows, args.wording)
    return 0


if __name__ == "__main__":
    sys.exit(main())
