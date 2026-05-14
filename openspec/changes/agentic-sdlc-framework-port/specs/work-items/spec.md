## ADDED Requirements

### Requirement: capability_required per work item
The system SHALL allow each work item to declare an array `capability_required` listing the capabilities an assignee must have to claim the item. Claim requests SHALL fail if the claiming agent's persona does not include all required capabilities.

#### Scenario: Block claim by under-capable agent
- **WHEN** an agent whose persona lacks the `database-migration` capability attempts to claim a work item requiring it
- **THEN** the system SHALL reject the claim with a 403 error naming the missing capability

### Requirement: Per-project done-checklist applied at create time
The system SHALL store a `done_checklist` array per work item (defaulted from the project's `settings.done_checklist` at create time) with entries `{ gate: string, completed: bool, completed_at: timestamp? }`. This is an additional gating layer on top of `validation-pipeline` — both must pass for `in_review` → `done`. The override-with-reason path defined in `validation-pipeline` also records overrides of done-checklist gates.

#### Scenario: Default checklist applied on create
- **WHEN** a work item is created in a project whose `settings.done_checklist` config lists three gates
- **THEN** the new work item SHALL have those three gates copied into its checklist with `completed: false`

#### Scenario: Done blocked until checklist + validation both pass
- **WHEN** all validation gates pass but the done-checklist has one unchecked gate
- **THEN** the `in_review` → `done` transition SHALL be rejected naming the unchecked gate
