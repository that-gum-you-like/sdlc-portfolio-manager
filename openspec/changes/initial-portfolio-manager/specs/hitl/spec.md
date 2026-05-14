## ADDED Requirements

### Requirement: Question model
The system SHALL support a `questions` entity attached to a work item with fields: `id` (UUID), `work_item_id`, `asked_by` (agent or human), `addressed_to` (optional @-mention target), `body` (markdown), `status` (`open` | `answered` | `cancelled`), `asked_at`, `answered_at`, `answer_id` (FK to the answer comment).

#### Scenario: Agent asks a question on a work item
- **WHEN** an agent POSTs to `/api/v1/work-items/:id/questions` with `{ body: "Should I use OAuth or magic links?", addressed_to: "@bryce" }`
- **THEN** the system SHALL create a question with `status=open`, link it to the work item, transition the work item to `needs-human` status if not already, and return the question id

#### Scenario: Human answers a question
- **WHEN** a human POSTs to `/api/v1/questions/:id/answer` with `{ body: "Use magic links — passkeys are next phase" }`
- **THEN** the system SHALL persist an answer comment, set the question's `status=answered` and `answer_id`, and transition the work item back to its prior status

### Requirement: needs-human status
The work-items status enum SHALL include `needs-human` representing "work paused, awaiting human input." This status SHALL appear as its own column on the Kanban board.

#### Scenario: Item enters needs-human when a question is asked
- **WHEN** an agent asks a question on a work item currently in `in_progress`
- **THEN** the system SHALL transition the item to `needs-human` and record `previous_status: in_progress`

#### Scenario: Item resumes prior status when all questions answered
- **WHEN** the last open question on a `needs-human` item is answered
- **THEN** the system SHALL transition the item back to its `previous_status`

#### Scenario: Multiple open questions hold needs-human
- **WHEN** an item has two open questions and one is answered
- **THEN** the item SHALL remain in `needs-human` until both are answered

### Requirement: @-mention parsing in comments and questions
The system SHALL parse `@<name>` tokens from any comment or question body and resolve each to either a human user (by username) or an agent (by persona name). Unresolved mentions SHALL be preserved verbatim but not fire notifications.

#### Scenario: Comment mentions an agent
- **WHEN** a human posts a comment "Hey @frontend-developer can you handle this?"
- **THEN** the system SHALL extract the mention `frontend-developer`, resolve it to the persona, create a mention record, and surface a notification for that agent

#### Scenario: Comment mentions an unknown handle
- **WHEN** a comment contains `@nobody-by-that-name`
- **THEN** the system SHALL store the comment verbatim, log no mention record, and not error

### Requirement: Inbox view
The system SHALL provide an `/inbox` route showing all unresolved items addressed to the current user across all work items: open questions @-mentioning them, comments @-mentioning them, and work items assigned to them awaiting their attention.

#### Scenario: Open inbox with three pending questions
- **WHEN** a user opens `/inbox` while three open questions @-mention them
- **THEN** the system SHALL list all three with work-item context, asking agent, asked-at timestamp, and a quick-answer form per item

#### Scenario: Inbox count surfaces on every page
- **WHEN** a user has 5 unresolved inbox items
- **THEN** the global navigation SHALL display "5" as an inbox badge on every page

### Requirement: Agent CLI commands for HITL
The `pc` CLI SHALL provide `pc ask <work-item-id> <message>` and `pc check-answer <question-id>`. The `ask` command SHALL support a `--wait <seconds>` flag that blocks until the question is answered or the timeout elapses.

#### Scenario: Agent asks asynchronously
- **WHEN** an agent runs `pc ask abc-123 "Use OAuth or magic links?"`
- **THEN** the CLI SHALL POST the question, print the question id, and exit 0 without waiting

#### Scenario: Agent waits for an answer
- **WHEN** an agent runs `pc ask abc-123 "..." --wait 600` and a human answers within 600 seconds
- **THEN** the CLI SHALL print the answer body to stdout and exit 0; if the timeout elapses first, exit code 4

#### Scenario: Agent polls for an answer
- **WHEN** an agent runs `pc check-answer q-456`
- **THEN** the CLI SHALL print the answer body and exit 0 if answered, or exit code 5 (unanswered) with no output

### Requirement: Human-to-agent reply triggers agent resumption
The system SHALL fire an "answer available" event when a question is answered, surfaced to the agent via (a) the CLI return value on `pc check-answer` / `pc ask --wait`, and (b) embedded in the next `pc next` response when the same agent next claims work.

#### Scenario: Agent picks up next task and gets pending answers in payload
- **WHEN** an agent calls `pc next` and has one previously-asked question now answered
- **THEN** the response SHALL include a `pending_answers: [{ question_id, answer_body, work_item_id }]` array alongside the claimed item

### Requirement: Notification record on mentions and questions
The system SHALL append a `notifications` row whenever a mention is created or a question is asked: `id`, `recipient` (user or agent name), `kind` (`mention` | `question` | `answer`), `source_id` (comment or question id), `work_item_id`, `created_at`, `read_at`.

#### Scenario: Mention creates notification
- **WHEN** a comment is posted mentioning `@bryce`
- **THEN** the system SHALL insert a notification row with `recipient=bryce, kind=mention`

#### Scenario: Mark notifications read on inbox open
- **WHEN** a user opens `/inbox`
- **THEN** the system SHALL set `read_at` on all currently-rendered notifications

### Requirement: Notification channel abstraction (in-app first; future-friendly)
The system SHALL deliver notifications via a pluggable channel interface; the only channel implemented at MVP is `in-app` (badge + inbox). Future channels (webhook, email, WhatsApp) SHALL register via the same interface without touching question/mention logic.

#### Scenario: Add a second channel without changing core
- **WHEN** a developer registers a `webhook` channel implementation
- **THEN** the system SHALL deliver the same notification to both `in-app` and `webhook` per project config, with no changes required to the question or mention modules
