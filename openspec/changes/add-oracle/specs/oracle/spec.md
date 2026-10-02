# Spec Delta

## Purpose

Lets callers send only a question and get an oracle-style answer from the decision model:
yes/no, or a Magic 8-Ball phrase with a percentage for every classic phrase.

## ADDED Requirements

### Requirement: Oracle request
Every oracle endpoint SHALL accept a JSON body with exactly one field, `question`, a non-empty
string. The question SHALL be the only text the model reads. The instructions and answer
options SHALL be fixed by the server and not changeable by the caller.

#### Scenario: Question only
- **WHEN** an authenticated caller posts `{"question": "¿Me saldrá bien el examen?"}` to an oracle endpoint
- **THEN** the response is `200`

#### Scenario: Extra fields rejected
- **WHEN** the body has a field other than `question`, such as `instructions` or `text`
- **THEN** the response is `422` naming that field, and no inference runs

#### Scenario: Empty question
- **WHEN** `question` is missing or an empty string
- **THEN** the response is `422`, and no inference runs

### Requirement: No low-confidence threshold
Oracle endpoints SHALL NOT apply a confidence threshold. A request with `min_confidence`
SHALL be rejected with `422`, and oracle responses SHALL never include `low_confidence`.

#### Scenario: Threshold sent
- **WHEN** a caller posts `{"question": "¿Lloverá mañana?", "min_confidence": 0.8}` to `/v1/oracle/yesno`
- **THEN** the response is `422` naming `min_confidence`

#### Scenario: No flag in answers
- **WHEN** any oracle request succeeds
- **THEN** the response contains no `low_confidence` field

### Requirement: Yes/no oracle answer
`POST /v1/oracle/yesno` SHALL answer every question with a boolean `answer`, `probability`
(P(yes), 0.0–1.0) and `confidence`. `answer` SHALL be true when `probability` ≥ 0.5.

#### Scenario: Yes/no question answered
- **WHEN** an authenticated caller posts `{"question": "¿Debería aceptar el nuevo trabajo?"}` to `/v1/oracle/yesno`
- **THEN** the response is `200` with a boolean `answer`, `probability` between 0 and 1, and `answer` equal to `probability ≥ 0.5`

### Requirement: Yes/no oracle always answers
The yes/no oracle SHALL NOT check whether the question can be answered with yes or no. It
SHALL answer any non-empty question; asking a yes/no question is the caller's responsibility.

#### Scenario: Open question still answered
- **WHEN** a caller posts `{"question": "¿Qué color de coche me compro?"}` to `/v1/oracle/yesno`
- **THEN** the response is `200` with a boolean `answer` and a `probability`

### Requirement: Magic 8-Ball phrases
`POST /v1/oracle/8ball` SHALL answer with the 20 classic Magic 8-Ball phrases in Spanish. Each
phrase SHALL be in one class: 10 `affirmative`, 5 `non_committal`, 5 `negative`. The phrases
SHALL be ordered from most negative to most affirmative, and that order SHALL be fixed.

#### Scenario: Every phrase listed
- **WHEN** an 8-Ball request succeeds
- **THEN** `phrases` has 20 entries in the fixed order, each with `phrase`, `kind` and `percentage`

### Requirement: Magic 8-Ball answer
The 8-Ball response SHALL include `answer`, the phrase with the highest percentage (the
earliest in order on a tie), its `kind`, and `percentage` per phrase (0–100, one decimal,
summing to 100 ±0.1). `totals` SHALL hold the summed percentage of each class.

#### Scenario: Winning phrase
- **WHEN** an authenticated caller posts `{"question": "¿Me tocará la lotería?"}` to `/v1/oracle/8ball`
- **THEN** the response is `200`, `answer` is the phrase with the highest `percentage`, `kind` is that phrase's class, and the percentages sum to 100 ±0.1

#### Scenario: Class totals
- **WHEN** an 8-Ball request succeeds
- **THEN** `totals` has `affirmative`, `non_committal` and `negative`, each the sum of its phrases' percentages

### Requirement: 8-Ball always answers
The 8-Ball oracle SHALL answer any non-empty question, including questions that are not yes/no
questions. It SHALL NOT refuse.

#### Scenario: Open question still answered
- **WHEN** a caller posts `{"question": "¿Qué color de coche me compro?"}` to `/v1/oracle/8ball`
- **THEN** the response is `200` with an `answer` from the 20 phrases

### Requirement: Response metadata
Every successful oracle response SHALL include `model` (the checkpoint used) and `latency_ms`
(integer, server-side inference time).

#### Scenario: Metadata present
- **WHEN** a yes/no or 8-Ball request succeeds
- **THEN** the response includes `model` and an integer `latency_ms`

### Requirement: Question length limit
The system SHALL reject a `question` longer than 500 characters with `413`, without running
inference.

#### Scenario: Question too long
- **WHEN** `question` has 501 characters
- **THEN** the response is `413`

### Requirement: Same guarantees as decide
Oracle requests SHALL use the same API-key authentication as `/v1/decide`. They SHALL return
`503` with `Retry-After` while loading or saturated. They SHALL share the one-at-a-time
inference queue, and their logs SHALL hold only metadata, never the question.

#### Scenario: No key
- **WHEN** an oracle request has no `Authorization` header
- **THEN** the response is `401`

#### Scenario: Model loading
- **WHEN** an oracle request arrives before the model is loaded
- **THEN** the response is `503` with `Retry-After`

#### Scenario: Logged without content
- **WHEN** an oracle request is processed
- **THEN** the logs contain the endpoint, status and latency but not the question

### Requirement: Documented oracle endpoints
`POST /v1/oracle/yesno` and `POST /v1/oracle/8ball` SHALL appear in the OpenAPI description
with a request example. They SHALL NOT be listed by `GET /v1/presets`.

#### Scenario: Operations in OpenAPI
- **WHEN** a client reads `/openapi.json`
- **THEN** it contains `POST /v1/oracle/yesno` and `POST /v1/oracle/8ball`

#### Scenario: Not a preset
- **WHEN** an authenticated caller requests `GET /v1/presets`
- **THEN** the response does not list any oracle

### Requirement: Recorded oracle evaluation
The repository SHALL keep a set of at least 30 Spanish questions and a report of the oracle's
answers to them. The report SHALL show the share of yes answers and the P(yes) spread, and how
often each 8-Ball phrase and class wins. It SHALL NOT gate publication.

#### Scenario: Report runs
- **WHEN** the oracle evaluation is run
- **THEN** it prints the share of yes answers, the P(yes) spread and a win count per 8-Ball phrase and class, and exits successfully whatever the values
