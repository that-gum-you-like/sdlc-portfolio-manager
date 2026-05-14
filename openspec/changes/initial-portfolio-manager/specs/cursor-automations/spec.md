## ADDED Requirements

### Requirement: Auto-pickup endpoint for ready work
The system SHALL expose `GET /api/v1/work-items/next-ready` returning at most one work item suitable for an automated Cursor Background Agent run, with optional filters by type/label/repo.

#### Scenario: Cursor Automation polls for ready work
- **WHEN** a Cursor Automation calls `GET /api/v1/work-items/next-ready?agent=cursor-bg&repo=my-app`
- **THEN** the system SHALL atomically pick the highest-rank `ready` work item matching the filters, transition it to `in_progress`, set assignee to `cursor-bg`, and return its JSON; if none match, respond 204 No Content

#### Scenario: Concurrent calls do not double-claim
- **WHEN** two automations call `next-ready` concurrently and only one ready item exists
- **THEN** exactly one call SHALL receive the item and the other SHALL receive 204

### Requirement: Scheduled-prompt registration
The system SHALL allow the user to define **automation entries** in the library that describe a Cursor Automation: a prompt body, a cron schedule, a scope (target repo, label filter, file glob), and a result-handling hook (e.g., "file new findings as bugs").

#### Scenario: Define a weekly security review automation
- **WHEN** a user creates a library entry of type `automation` with prompt "Run a security review on changes since last week," cron `0 9 * * MON`, scope `repo=my-app`, and hook `file-findings-as-bugs`
- **THEN** the system SHALL persist the entry, validate the cron expression, and surface it in the library list under the `automation` filter

#### Scenario: Reject invalid cron
- **WHEN** a user submits an automation with cron expression `not-a-cron`
- **THEN** the system SHALL reject the save with a parse error and leave the prior version unchanged

### Requirement: Publish automations to target repo
The system SHALL include automation entries in the publish flow: when an automation is selected for publish, the system writes it into the target repo in the format Cursor Automations expects on disk (path/format to be confirmed against Cursor docs before the writer is locked).

#### Scenario: Publish a security-review automation to a repo
- **WHEN** a user selects an automation entry and publishes it to a target repo
- **THEN** the system SHALL write the automation definition into the appropriate location in the target repo and record the publish event in `publish_history`

### Requirement: Result intake from automation runs
The system SHALL accept POSTs from Cursor automation runs reporting outcomes — comments, status changes, and newly-filed work items — against the work item the automation was scoped to.

#### Scenario: Security review files three bugs
- **WHEN** a scheduled security-review automation calls `POST /api/v1/automation-results` with three new bugs and one comment on the parent review item
- **THEN** the system SHALL create three new bug work items linked to the parent review item and append the comment, returning the new bug ids

### Requirement: Automation run history
The system SHALL record each automation run (started_at, completed_at, status, summary, ids of items created/affected) and surface this history on the automation entry's detail page.

#### Scenario: View history for a weekly security review
- **WHEN** a user opens an automation entry that has run six times
- **THEN** the system SHALL list all six runs with timestamps, completion status, and counts of items created/affected, sorted most recent first

### Requirement: Automation entries are first-class library entries
The system SHALL model automation entries within the same library entity as rules and skills (`library_entries` table) differentiated by a `type` column (`rule` | `skill` | `automation`), so browse / edit / publish flows are uniform.

#### Scenario: Filter library by automation type
- **WHEN** a user filters the library view by type `automation`
- **THEN** the system SHALL show only automation entries, with their cron schedule visible in the card preview
