# Spec Delta

## Purpose

Offers named, ready-made and validated question sets (presets) so callers can get a typed
decision over a text by sending only the text, without writing their own questions.

## ADDED Requirements

### Requirement: List presets
The system SHALL expose `GET /v1/presets`, authenticated like `/v1/decide`, returning every
published preset with a short description and its questions in the same format that
`/v1/decide` accepts (name → `type`, `instructions`, `criteria`), without running inference.

#### Scenario: Presets listed
- **WHEN** an authenticated caller requests `GET /v1/presets`
- **THEN** the response is `200` with a `presets` object keyed by preset name, each with `description` and `questions`

#### Scenario: Listed questions are reusable
- **WHEN** a caller copies a preset's `questions` into a `POST /v1/decide` body with a text
- **THEN** that request is accepted (`200`), not rejected as malformed

#### Scenario: Listing available while loading
- **WHEN** the model is still loading
- **THEN** `GET /v1/presets` still returns `200`

#### Scenario: Listing requires a key
- **WHEN** `GET /v1/presets` is requested without a valid API key
- **THEN** the response is `401`

### Requirement: Run a preset
The system SHALL expose `POST /v1/presets/{name}` accepting `text` and optional
`min_confidence`, and SHALL answer all of the preset's questions with the same answer
shapes, `low_confidence` semantics, `model` and `latency_ms` as `/v1/decide`, adding a
`preset` field with the preset name.

#### Scenario: Triage preset
- **WHEN** an authenticated caller posts `text` = "Me habéis cobrado dos veces, quiero que me devolváis el dinero" to `/v1/presets/triage`
- **THEN** the response is `200` with `preset` = `triage` and one answer per triage question, keyed by question name

#### Scenario: Threshold applied
- **WHEN** the request sets `min_confidence` = 0.99
- **THEN** every answer carries `low_confidence`, and none is withheld

### Requirement: Question subset
A preset request MAY include `questions`, a non-empty list of question names from that
preset; the system SHALL then answer only those questions. A name not in the preset SHALL be
rejected with `422` naming it, without running inference.

#### Scenario: Subset answered
- **WHEN** a caller posts to `/v1/presets/guard` with `questions` = `["jailbreak"]`
- **THEN** `answers` contains only `jailbreak`

#### Scenario: Unknown question in subset
- **WHEN** `questions` contains a name that the preset does not define
- **THEN** the response is `422` and the error names that question

### Requirement: Unknown preset
The system SHALL answer `404` with a JSON error naming the preset when `{name}` is not a
published preset, without running inference.

#### Scenario: Preset does not exist
- **WHEN** an authenticated caller posts to `/v1/presets/horoscope`
- **THEN** the response is `404` and the error names `horoscope`

### Requirement: Same guarantees as decide
Preset requests SHALL be subject to the same API-key authentication, `422` validation of
malformed bodies, `413` text-length limit, `503` while loading or saturated, shared
one-at-a-time inference queue, and content-free request logging as `/v1/decide`.

#### Scenario: Text too long
- **WHEN** a preset request has a `text` of 8,001 characters
- **THEN** the response is `413`

#### Scenario: No key
- **WHEN** a preset request has no `Authorization` header
- **THEN** the response is `401`

#### Scenario: Model loading
- **WHEN** a preset request arrives before the model is loaded
- **THEN** the response is `503` with `Retry-After`

#### Scenario: Logged without content
- **WHEN** a preset request is processed
- **THEN** the logs contain the preset name, status, latency and question count, but not the text

### Requirement: Spanish, validated questions
Preset instructions and option descriptions SHALL be in Spanish, and every published preset
question SHALL reach at least 80 % balanced accuracy (mean recall per expected answer) on a
labelled Spanish evaluation set of at least 10 texts per question, kept in the repository
and run against the deployed checkpoint.

#### Scenario: Evaluation passes
- **WHEN** the preset evaluation is run against the pinned model revision
- **THEN** it reports at least 80 % balanced accuracy for every published preset question

#### Scenario: Majority-only answers do not pass
- **WHEN** a yes/no question answers `false` for every text, and 3 of its 16 labelled texts are `true`
- **THEN** its balanced accuracy is 50 % and it is not published, although plain accuracy is 81 %

#### Scenario: Failing question not published
- **WHEN** a candidate question stays below 80 % balanced accuracy after rewording
- **THEN** it does not appear in `GET /v1/presets` and cannot be requested
