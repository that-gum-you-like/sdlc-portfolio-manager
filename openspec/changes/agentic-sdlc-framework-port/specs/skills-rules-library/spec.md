## MODIFIED Requirements

### Requirement: Library browse view
The system SHALL render a browsable library of Cursor rules, skills, automations, and **docs**, where each entry shows name, description, tags, and a preview of its frontmatter. The browse view SHALL support filtering by `type` (`rule` | `skill` | `automation` | `doc`), `role` (e.g., `persona`), `category` (e.g., `framework`), and free-text search.

#### Scenario: Open the library and see seeded entries
- **WHEN** a user navigates to the library view after first install
- **THEN** the system SHALL list all rules, skills, automations, and docs shipped under `cursor-templates/` plus any entries the user has created locally

#### Scenario: Filter library by role=persona
- **WHEN** a user filters the library by `role=persona`
- **THEN** the system SHALL render only the 19 seeded persona entries

#### Scenario: Filter library by category=framework
- **WHEN** a user filters the library by `category=framework`
- **THEN** the system SHALL render only the seeded framework knowledge `doc` entries
