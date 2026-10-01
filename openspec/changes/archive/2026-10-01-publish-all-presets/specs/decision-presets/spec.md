# Spec Delta

## ADDED Requirements

### Requirement: Spanish preset questions
Preset instructions, option descriptions and score levels SHALL be written in Spanish, and the
published presets SHALL be `triage`, `guard`, `email`, `moderation` and `router`, each with all
of its questions.

#### Scenario: All presets listed
- **WHEN** an authenticated caller requests `GET /v1/presets`
- **THEN** the response lists `triage`, `guard`, `email`, `moderation` and `router`

#### Scenario: Complete triage
- **WHEN** a caller posts a text to `/v1/presets/triage` without `questions`
- **THEN** `answers` contains `intent`, `is_urgent`, `frustration`, `refund_requested` and `churn_risk`

### Requirement: Recorded preset evaluation
The repository SHALL keep a labelled Spanish evaluation set with at least 10 texts per preset
question and a report that measures accuracy and balanced accuracy per question against the
pinned checkpoint. The report SHALL NOT decide which questions are published.

#### Scenario: Report covers every question
- **WHEN** the preset evaluation is run
- **THEN** it prints accuracy and balanced accuracy for every published question and exits successfully, whatever the values

## REMOVED Requirements

### Requirement: Spanish, validated questions
**Reason**: The API owner chose to publish all Laya presets complete; the 80 % gate kept only
6 of 24 questions.
**Migration**: None for clients. Questions below the former bar are now published; their
measured accuracy is in `server/README.md`. Clients that need reliability on a question should
check it on their own texts or use `/v1/decide` with their own wording.
