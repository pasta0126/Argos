# Spec Delta

## ADDED Requirements

### Requirement: Oracle group on the mode step
The mode step SHALL show an oracle group below the custom and preset cards, with its own
heading and a visual theme distinct from the cards above. The group SHALL hold two cards:
the yes/no oracle (`POST /v1/oracle/yesno`) and the Magic 8-Ball (`POST /v1/oracle/8ball`).
Each card SHALL have a short description and its endpoint.

#### Scenario: Oracle group shown
- **WHEN** the mode step is shown with a valid key
- **THEN** below the custom and preset cards there is a separate, themed oracle group with the yes/no and 8-Ball cards

#### Scenario: Custom stays the default
- **WHEN** the mode step is first shown
- **THEN** the custom request is still selected, and no oracle card is selected

#### Scenario: Oracle chosen
- **WHEN** the user selects the 8-Ball card
- **THEN** that card is marked as selected and the payload preview targets `POST /v1/oracle/8ball`

### Requirement: Oracle request building
In oracle mode the wizard SHALL send `{"question": <text>}` to the selected oracle endpoint
and nothing else. The questions step SHALL show the fixed oracle question read-only, with
nothing to edit or choose.

#### Scenario: Oracle payload
- **WHEN** the user picks the yes/no oracle and types "¿Lloverá mañana?"
- **THEN** the previewed and sent request is `POST /v1/oracle/yesno` with body exactly `{"question": "¿Lloverá mañana?"}`

#### Scenario: Questions step read-only
- **WHEN** the user reaches the questions step in oracle mode
- **THEN** it explains what the oracle asks and offers no question editor or subset selection

#### Scenario: Yes/no hint
- **WHEN** the yes/no oracle is selected and the user is on the text step
- **THEN** the wizard says the question has to be answerable with sí or no, because the oracle answers anything with sí or no

### Requirement: Oracle result views
Oracle results SHALL use the oracle theme. A yes/no result SHALL show a large Sí or No with
P(yes) and confidence. An 8-Ball result
SHALL show the winning phrase prominently, a bar per phrase in scale order colored by class,
and the three class totals.

#### Scenario: Yes/no answered
- **WHEN** `/v1/oracle/yesno` returns `answer: true`, `probability` 0.82
- **THEN** the result shows a large "Sí" and 82 %

#### Scenario: 8-Ball answered
- **WHEN** `/v1/oracle/8ball` returns `answer` "Sin lugar a dudas"
- **THEN** that phrase is shown prominently, all 20 phrases appear as bars with their percentages, and the affirmative, non-committal and negative totals are shown

### Requirement: Oracle theme in both color schemes
The oracle theme SHALL have light and dark variants that follow the wizard's color scheme,
and its text SHALL stay readable against its background in both.

#### Scenario: Dark mode
- **WHEN** the browser prefers a dark color scheme
- **THEN** the oracle group and oracle results use the dark variant of the oracle theme

## MODIFIED Requirements

### Requirement: Text step
The text step SHALL accept free text, show a live character count against the 8,000
character limit, and block advancing when the text is empty or over the limit. In oracle
mode the step SHALL ask for the question instead, with a 500-character limit.

#### Scenario: Over limit
- **WHEN** the text has 8,001 characters
- **THEN** the counter is marked as exceeded and the wizard does not advance

#### Scenario: Oracle question over limit
- **WHEN** an oracle is selected and the question has 501 characters
- **THEN** the counter is marked as exceeded against 500 and the wizard does not advance

### Requirement: Options step
The options step SHALL let the user set or leave unset `min_confidence` (0.0–1.0),
explaining that it only flags answers and never hides them. The flag SHALL be on by
default with a threshold of 0.8. In oracle mode the flag SHALL always be unchecked and
disabled, with a note that the oracle has no confidence threshold.

#### Scenario: Flag on by default
- **WHEN** a new request is started
- **THEN** the low-confidence option is checked and the payload has `min_confidence` 0.8

#### Scenario: Threshold unset
- **WHEN** the user leaves the threshold off
- **THEN** the payload has no `min_confidence`

#### Scenario: Oracle has no threshold
- **WHEN** an oracle is selected
- **THEN** the low-confidence option is unchecked and cannot be checked, and the payload has no `min_confidence`

#### Scenario: Back to custom keeps the user's choice
- **WHEN** the user had the flag on, selects an oracle, and then goes back to custom mode
- **THEN** the flag is checked again with the threshold the user had set
