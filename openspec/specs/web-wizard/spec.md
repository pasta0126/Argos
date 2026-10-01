# web-wizard Specification

## Purpose
A browser UI at `argos.northernarchive.com` that guides a user, step by step, through
building a decision request, sends it to the Argos API, and explains the answer visually,
showing the exact JSON exchanged and keeping the user informed of what is happening.

## Requirements

### Requirement: Served on its own domain
The wizard SHALL be served at `https://argos.northernarchive.com/` and SHALL call the Argos
API at `https://argos-api.northernarchive.com`, the only origin it sends requests to.

#### Scenario: Root serves the wizard
- **WHEN** a browser opens `https://argos.northernarchive.com/`
- **THEN** the wizard page loads

#### Scenario: Calls go to the API host
- **WHEN** the wizard checks health, verifies the key or sends a decision
- **THEN** the browser requests `https://argos-api.northernarchive.com/...` and no other host

### Requirement: Logo returns home
The header logo and title SHALL be a link that returns to the start of the wizard (the mode
step, or the key step when no key is set) without discarding the request being built.

#### Scenario: Home from a later step
- **WHEN** the user is on the questions step and clicks the Argos logo
- **THEN** the wizard shows the mode step and the request built so far is kept

### Requirement: Spanish interface
All wizard text (labels, help, status and error messages) SHALL be in Spanish; API field
names in JSON views SHALL stay as the API defines them.

#### Scenario: Error message language
- **WHEN** the API answers `401`
- **THEN** the wizard shows a Spanish message explaining that the key is missing or invalid

### Requirement: API key entry
The wizard SHALL ask for an API key before any `/v1/*` call, verify it with
`GET /v1/presets`, and send it only as `Authorization: Bearer` to the API origin. The key
SHALL be kept in the browser only, for the tab session by default, or across sessions only
if the user opts in, and SHALL be removable with one action.

#### Scenario: Valid key
- **WHEN** the user enters a key and the API answers `200` to `GET /v1/presets`
- **THEN** the wizard confirms the key and advances, with the presets list loaded

#### Scenario: Invalid key
- **WHEN** the API answers `401` to the check
- **THEN** the wizard stays on the key step and says the key is not valid

#### Scenario: Remember opted out
- **WHEN** the user did not choose to remember the key and closes the tab
- **THEN** reopening the wizard asks for the key again

#### Scenario: Forget key
- **WHEN** the user chooses to forget the key
- **THEN** the key is removed from browser storage and the wizard returns to the key step

#### Scenario: Key never displayed in shared output
- **WHEN** the wizard shows a payload, a response or a curl command
- **THEN** the key does not appear in it (curl uses a placeholder)

### Requirement: Wizard steps
The wizard SHALL guide the user through ordered steps — key, mode, text, questions,
options, review — showing the current step and allowing going back without losing entered
data. A step SHALL not advance while its input is invalid, and SHALL say why.

#### Scenario: Back keeps data
- **WHEN** the user is on the review step and goes back to the text step
- **THEN** the text and the configured questions are still there

#### Scenario: Blocked step explains itself
- **WHEN** the user tries to advance from the text step with an empty text
- **THEN** the wizard does not advance and shows that the text is required

### Requirement: Request modes
On the mode step the user SHALL choose between a custom request, selected by default and
shown first with a favourite mark, and each published preset fetched from
`GET /v1/presets`, shown with its description.

#### Scenario: Custom by default
- **WHEN** the mode step is first shown
- **THEN** the custom request is selected and listed first

#### Scenario: Presets offered
- **WHEN** the mode step is shown with a valid key
- **THEN** every preset returned by `GET /v1/presets` is selectable, with its description

### Requirement: Text step
The text step SHALL accept free text, show a live character count against the 8,000
character limit, and block advancing when the text is empty or over the limit.

#### Scenario: Over limit
- **WHEN** the text has 8,001 characters
- **THEN** the counter is marked as exceeded and the wizard does not advance

### Requirement: Preset question selection
In preset mode the questions step SHALL list the preset's questions (name, type,
instructions, options) and let the user answer all of them or a non-empty subset; a subset
SHALL be sent as the `questions` list to `POST /v1/presets/<name>`.

#### Scenario: Subset sent
- **WHEN** the user keeps only `jailbreak` checked in the `guard` preset
- **THEN** the request is `POST /v1/presets/guard` with `questions` = `["jailbreak"]`

#### Scenario: All selected
- **WHEN** every question is checked
- **THEN** the request omits `questions`

#### Scenario: Customize a preset
- **WHEN** the user chooses to customize the selected preset
- **THEN** the wizard switches to custom mode with the preset's questions loaded into the editor

### Requirement: Custom question editor
In custom mode the user SHALL add, edit, reorder and remove questions. Each question SHALL
have a unique name, a type (choice, score, yes/no) and instructions; choice questions SHALL
edit option label → description pairs, score questions an ordered list of levels (lowest
first), and yes/no questions optional `yes`/`no` descriptions. Each type SHALL be explained
in the UI.

#### Scenario: Build a choice question
- **WHEN** the user adds a choice question `department` with options `billing` and `technical`
- **THEN** the payload contains `questions.department` with `type` `choice` and both options in `criteria`

#### Scenario: Optional yes/no descriptions
- **WHEN** a yes/no question leaves both descriptions empty
- **THEN** its payload has no `criteria`

### Requirement: Client-side validation mirrors the API
The wizard SHALL block sending, pointing at the offending field, any custom request that
the API would reject: no questions, more than 10 questions, duplicate or empty question
names, empty instructions, a choice or score with fewer than 2 or more than 20 options, an
empty option label or description, or a yes/no with only one description filled.

#### Scenario: Too many questions
- **WHEN** the user tries to add an eleventh question
- **THEN** the wizard prevents it and explains the limit of 10

#### Scenario: One-option choice
- **WHEN** a choice question has a single option
- **THEN** the review step shows the error on that question and the send action is disabled

### Requirement: Options step
The options step SHALL let the user set or leave unset `min_confidence` (0.0–1.0),
explaining that it only flags answers and never hides them. The flag SHALL be on by
default with a threshold of 0.8.

#### Scenario: Flag on by default
- **WHEN** a new request is started
- **THEN** the low-confidence option is checked and the payload has `min_confidence` 0.8

#### Scenario: Threshold unset
- **WHEN** the user leaves the threshold off
- **THEN** the payload has no `min_confidence`

### Requirement: Live payload preview
While the user builds the request, the wizard SHALL show the JSON body and the target
endpoint that would be sent, updated on every change, with a copy action.

#### Scenario: Preview follows edits
- **WHEN** the user renames a question from `q1` to `refund`
- **THEN** the previewed JSON shows `refund` and no longer `q1`

### Requirement: Result views
After a successful call the wizard SHALL show the sent payload JSON, the received response
JSON and a curl command reproducing the call, each copyable, plus a visual view of every
answer and the response's `model` and `latency_ms`.

#### Scenario: Both JSON documents available
- **WHEN** a decision returns `200`
- **THEN** the user can view and copy the exact request body and the exact response body

### Requirement: Answer visualization
The visual view SHALL render each answer by type: choice as one bar per option with its
percentage and the chosen option highlighted; score as one bar per level in level order
with the selected `level` highlighted and the expected `score` marked on the scale; yes/no
as a yes/no split bar with P(yes) and the boolean answer. Every answer SHALL show its
confidence, and a visible flag when `low_confidence` is true.

#### Scenario: Choice bars
- **WHEN** a choice answer has probabilities billing 0.91, technical 0.06, other 0.03
- **THEN** three bars show 91 %, 6 % and 3 % with `billing` highlighted

#### Scenario: Score marker
- **WHEN** a score answer over three levels has `score` 1.6 and `level` "bloqueante"
- **THEN** the level bars are shown in order, "bloqueante" is highlighted and a marker sits at 1.6 on the 0–2 scale

#### Scenario: Low confidence flagged
- **WHEN** an answer has `low_confidence: true`
- **THEN** that answer shows a low-confidence warning and is still fully displayed

### Requirement: Service status feedback
The wizard SHALL always show the service state from `GET /health`: checking, model loading,
ready, or unreachable. While the model loads it SHALL re-check periodically and update the
state without a page reload.

#### Scenario: Model loading
- **WHEN** `/health` answers `503` with `status` `loading`
- **THEN** the wizard shows that the model is loading and later shows ready once `/health` answers `200`

#### Scenario: Service down
- **WHEN** `/health` cannot be reached
- **THEN** the wizard shows the service as unreachable

### Requirement: Request progress feedback
While a decision is in flight the wizard SHALL show that it is running, the elapsed time,
an expected duration based on the questions and their number of options, and a cancel action; the send action
SHALL be disabled to prevent duplicate submissions.

#### Scenario: Running
- **WHEN** the user sends a request with 3 questions
- **THEN** the wizard shows a running state with a ticking elapsed time and an expected duration of a few seconds

#### Scenario: Cancel
- **WHEN** the user cancels a running request
- **THEN** the request is aborted, the wizard says it was cancelled, and the built request is kept

### Requirement: Automatic retry on unavailable
On a `503` (`loading` or `busy`) the wizard SHALL explain the cause, wait the `Retry-After`
seconds (default 5) with a visible countdown, and retry automatically, up to a bounded
number of attempts, after which it SHALL stop and let the user retry manually.

#### Scenario: Busy then success
- **WHEN** the first attempt gets `503` `busy` and the retry gets `200`
- **THEN** the wizard shows "servidor ocupado, reintentando en N s", then the result

#### Scenario: Retries exhausted
- **WHEN** every automatic attempt gets `503`
- **THEN** the wizard stops retrying and offers a manual retry

### Requirement: Error explanation
For every failed call the wizard SHALL show a Spanish explanation and the raw error body:
`401` invalid key (offering to change it), `413` the limit exceeded, `422` the offending
field, `404` unknown preset, and network failures.

#### Scenario: Validation error from the API
- **WHEN** the API answers `422` with an error located at `body.questions.refund.criteria`
- **THEN** the wizard names `refund` as the problematic question and shows the raw error JSON
