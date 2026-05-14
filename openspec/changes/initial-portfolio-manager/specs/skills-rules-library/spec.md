## ADDED Requirements

### Requirement: Library browse view
The system SHALL render a browsable library of Cursor rules and skills, where each entry shows name, description, tags, and a preview of its frontmatter.

#### Scenario: Open the library and see seeded entries
- **WHEN** a user navigates to the library view after first install
- **THEN** the system SHALL list all rules and skills shipped under `cursor-templates/` plus any entries the user has created locally

### Requirement: In-app rule editor
The system SHALL provide an in-app editor for each library entry that supports markdown editing of the body and structured editing of the YAML frontmatter (`description`, `globs`, `alwaysApply`, etc.).

#### Scenario: Edit a rule's frontmatter
- **WHEN** a user changes the `globs` field for a rule from `**/*.tsx` to `**/*.{tsx,ts}` and saves
- **THEN** the system SHALL persist the updated frontmatter and validate that it parses as YAML before saving

#### Scenario: Validation rejects malformed frontmatter
- **WHEN** a user enters invalid YAML in the frontmatter and clicks save
- **THEN** the system SHALL prevent the save, surface the parse error inline, and leave the prior version unchanged

### Requirement: Create new rule or skill
The system SHALL allow the user to create a new library entry from a template, choosing between `rule`, `skill`, `automation`, or `validator` types.

#### Scenario: Create a new rule from blank template
- **WHEN** a user clicks "New rule", selects the `rule` type, and provides a name
- **THEN** the system SHALL create a new entry with a stubbed frontmatter and empty body, and open it in the editor

#### Scenario: Create a new validator
- **WHEN** a user clicks "New validator", selects gate `quality`, and saves with command, pass_exit_codes, and timeout filled in
- **THEN** the system SHALL persist a `validator`-type entry and surface it under the library filter `type=validator, gate=quality`

### Requirement: Publish to target repo
The system SHALL provide a "Publish" action that writes a selected subset of library entries into a target repository's `.cursor/rules/` (for rules) or `.cursor/skills/` (for skills) directory.

#### Scenario: Publish a curated set to a target repo
- **WHEN** a user selects three rules and one skill, picks a target repo path, and clicks "Publish"
- **THEN** the system SHALL write the four entries as `.mdc` files into the appropriate subdirectories of the target repo, preserving frontmatter, and report success per file

#### Scenario: Publish refuses to overwrite without confirmation
- **WHEN** publishing would overwrite an existing file in the target repo
- **THEN** the system SHALL pause and require explicit per-file confirmation before proceeding

### Requirement: Track which repos use which entries
The system SHALL record which library entries have been published into which target repos and surface this on each entry's detail view.

#### Scenario: View publish history for an entry
- **WHEN** a user opens an entry's detail view after publishing it twice to different repos
- **THEN** the system SHALL list both target repos with timestamps of last publish
