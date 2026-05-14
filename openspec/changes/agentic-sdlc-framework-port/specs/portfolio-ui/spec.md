## MODIFIED Requirements

### Requirement: Dashboard with four focused sections
The base dashboard from `initial-portfolio-manager` (Today's focus, Active work, Health, Recent activity) SHALL be extended with maturation, drift, and override insights surfaced via existing sections, not as new primary blocks (per Decision 18 — restraint):

- **Health** SHALL incorporate capability-drift warning count and maturation snapshot link
- **Recent activity** SHALL include `maturation_events`, override entries, and recent automation runs in the same chronological feed
- A dedicated `/dashboard/insights` deep-link SHALL provide the full maturation × drift × override × automation breakdown for users who want it

#### Scenario: Health section shows drift warning
- **WHEN** an agent has capabilities flagged as drift in the last 7 days
- **THEN** the Health section SHALL display "N capability drift warnings" with a link to `/dashboard/insights#drift`

#### Scenario: Insights page surfaces full maturation matrix
- **WHEN** a user opens `/dashboard/insights`
- **THEN** the system SHALL render a matrix of (agent × target-repo × current-level) with most-recent transition timestamps and the override + automation feeds expanded

## ADDED Requirements

### Requirement: Agent detail view
The system SHALL provide a `/agents/<name>` route for each persona showing: persona body, capabilities declared, capability log (recent), maturation level per target repo, recent memory entries, work items assigned (open + recent closed).

#### Scenario: Open Roy's detail page
- **WHEN** a user navigates to `/agents/backend-developer`
- **THEN** the system SHALL render the persona's frontmatter, body, declared capabilities, recent capability log, maturation per target repo, and a list of open assignments

### Requirement: Target-repo detail view
The system SHALL provide a `/repos/<slug>` route per target repo showing: agents published, automations published, recent runs, defeat-allowlist (read from the repo), publish history.

#### Scenario: Open a target repo detail view
- **WHEN** a user opens `/repos/my-app`
- **THEN** the system SHALL render published personas, published automations, recent runs from those automations, the allowlist contents, and the publish history
