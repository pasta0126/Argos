# decision-api Specification

## Purpose

Lets callers submit a piece of text with a set of typed questions and receive a structured,
probabilistic decision for each question in a single HTTP request.

## Requirements

### Requirement: Decide endpoint
The system SHALL expose `POST /v1/decide` accepting a JSON body with a `text` string and a
`questions` object mapping a caller-chosen question name to a question definition, and SHALL
answer every question in one response.

#### Scenario: Multiple questions answered in one call
- **WHEN** an authenticated caller posts `text` = "Me han cobrado dos veces, quiero un reembolso" with questions `department` (choice) and `refund` (yesno)
- **THEN** the response is `200` with `answers.department` and `answers.refund`, keyed by the same names

#### Scenario: Response metadata
- **WHEN** a decide request succeeds
- **THEN** the response includes `model` (the checkpoint used) and `latency_ms` (integer, server-side inference time)

### Requirement: Choice questions
A question with `type: "choice"` SHALL require `instructions` and a `criteria` object of
option label → description, and its answer SHALL contain the selected `choice`, a
`probabilities` object covering every option and summing to 1 (±0.001), and `confidence`.

#### Scenario: Choice answer
- **WHEN** a choice question has criteria `billing` and `technical`
- **THEN** the answer has `choice` equal to one of `billing` / `technical`, `probabilities` with both keys, and `confidence` equal to the highest probability

### Requirement: Score questions
A question with `type: "score"` SHALL require `instructions` and `criteria` as an ordered
list of level descriptions (lowest first), and its answer SHALL contain `score` (expected
level index, a number from 0 to number of levels − 1), `level` (the label of the nearest
level), `probabilities` per level, and `confidence`.

#### Scenario: Score answer
- **WHEN** a score question has criteria `["not urgent", "soon", "blocking"]`
- **THEN** the answer has `score` between 0 and 2, `level` one of the three labels, and three `probabilities`

### Requirement: Yes/no questions
A question with `type: "yesno"` SHALL require `instructions`, MAY include `criteria` with
exactly the keys `yes` and `no` describing each outcome, and its answer SHALL contain
`probability` (calibrated P(yes), 0.0–1.0) and `answer` (`true` when `probability` ≥ 0.5).

#### Scenario: Yes/no answer
- **WHEN** a yesno question asks "Does the user threaten to cancel?" about a text that threatens to cancel
- **THEN** the answer has `probability` between 0 and 1 and a boolean `answer`

### Requirement: Optional confidence threshold
The request MAY include `min_confidence` (0.0–1.0); when present, every answer whose
confidence is below it SHALL carry `low_confidence: true`, and all other answers SHALL carry
`low_confidence: false`. Answers SHALL never be withheld because of it.

#### Scenario: Low-confidence flag
- **WHEN** a request sets `min_confidence` = 0.99 and an answer's confidence is 0.7
- **THEN** that answer is returned in full with `low_confidence: true`

#### Scenario: Threshold omitted
- **WHEN** a request omits `min_confidence`
- **THEN** answers do not include a `low_confidence` field

### Requirement: Input validation
The system SHALL reject a malformed request with `422` and a JSON error naming the offending
field, without running inference. Malformed includes: missing or empty `text`, no questions,
unknown question `type`, missing `instructions`, or `criteria` that does not match the type.

#### Scenario: Unknown question type
- **WHEN** a question has `type: "ranking"`
- **THEN** the response is `422` and the error identifies that question

#### Scenario: Choice with one option
- **WHEN** a choice question has a single criterion
- **THEN** the response is `422`

### Requirement: Request size limits
The system SHALL reject with `413` any request whose `text` exceeds 8,000 characters, that
has more than 10 questions, or that has a choice/score question with more than 20 options,
without running inference.

#### Scenario: Text too long
- **WHEN** `text` has 8,001 characters
- **THEN** the response is `413`

#### Scenario: Too many questions
- **WHEN** a request has 11 questions
- **THEN** the response is `413`

### Requirement: Bounded concurrency
The system SHALL run at most one inference at a time, SHALL let a bounded number of requests
wait for their turn, and SHALL reject requests beyond that bound with `503` and a
`Retry-After` header instead of queueing them indefinitely.

#### Scenario: Server saturated
- **WHEN** one inference is running and the wait queue is full
- **THEN** a new decide request immediately receives `503` with `Retry-After`

#### Scenario: Waiting request is served
- **WHEN** one inference is running and the wait queue has room
- **THEN** a new decide request waits and then receives `200`

### Requirement: Text privacy in logs
The system SHALL NOT write request `text`, question instructions or criteria to its logs;
request logs SHALL contain only metadata (status, latency, number of questions, key id).

#### Scenario: Request logged without content
- **WHEN** a decide request is processed
- **THEN** the container logs contain its status and latency but not the submitted text
