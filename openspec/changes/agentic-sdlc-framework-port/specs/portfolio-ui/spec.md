## ADDED Requirements

### Requirement: Dashboard view
The system SHALL render a `/dashboard` route summarizing: today's progress (counts of items moved per status), open bottlenecks, maturation snapshot per (agent × target-repo), capability drift warnings, recent overrides, recent automation runs.

#### Scenario: Dashboard loads with all sections
- **WHEN** a user navigates to `/dashboard`
- **THEN** the system SHALL render six sections — Progress, Bottlenecks, Maturation, Drift, Overrides, Automation Runs — each with at least the most recent five entries or empty-state placeholder

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
