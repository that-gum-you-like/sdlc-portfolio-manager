## ADDED Requirements

### Requirement: Generic relationships table
The system SHALL persist relationships in a single `relationships` table with columns: `id` (UUID), `source_type` (enum: `portfolio` | `project` | `work_item`), `source_id` (UUID), `target_type` (same enum), `target_id` (UUID), `type` (enum: `parent_of` | `blocks` | `depends_on` | `duplicates` | `related_to` | `predecessor_of`), `created_at`, `created_by`, optional `note` (markdown).

#### Scenario: Persist a cross-project blocks relationship
- **WHEN** a client POSTs `{ source: { type: "work_item", id: "wi-a" }, target: { type: "work_item", id: "wi-b" }, type: "blocks" }`
- **THEN** the system SHALL persist the relationship and surface it on both endpoints' relationship panels (as `blocks` on A, as `blocked_by` on B via inverse computation)

#### Scenario: Cross-portfolio relationships allowed
- **WHEN** a client creates a `depends_on` relationship from a project in portfolio P1 to a project in portfolio P2
- **THEN** the system SHALL accept and persist it; relationships are not constrained to within a portfolio

### Requirement: Relationship types and their inverses
The system SHALL recognize six relationship types with these inverse semantics (inverse computed at read time, not stored as a separate row):

| Type | Inverse | Symmetric? |
|------|---------|------------|
| `parent_of` | `child_of` | no |
| `blocks` | `blocked_by` | no |
| `depends_on` | `required_by` | no |
| `duplicates` | `duplicated_by` | no |
| `related_to` | `related_to` | yes |
| `predecessor_of` | `successor_of` | no |

#### Scenario: Inverse surfaced without duplicate row
- **WHEN** an `A blocks B` row exists and a client queries B's relationships
- **THEN** the system SHALL return one inbound `blocked_by` relationship pointing to A, with no separate row in the table

#### Scenario: Symmetric `related_to` deduplicated on create
- **WHEN** a client creates `A related_to B` and later creates `B related_to A`
- **THEN** the system SHALL persist only the first; the second SHALL return the existing relationship's id

### Requirement: Validation — no self, no cycles in hierarchical types
The system SHALL reject any relationship whose source and target are identical, and SHALL reject any `parent_of` relationship that would create a cycle (e.g., `A parent_of B` then attempting `B parent_of A`, or longer cycles through intermediate nodes).

#### Scenario: Reject self-relationship
- **WHEN** a client POSTs a relationship whose source equals target
- **THEN** the system SHALL reject with a 400 error code `self_relationship_forbidden`

#### Scenario: Reject cycle in parent_of
- **WHEN** `A parent_of B` and `B parent_of C` exist, and a client attempts `C parent_of A`
- **THEN** the system SHALL reject with a 400 error code `cycle_detected` and a path snippet showing the cycle

### Requirement: Sibling computation
The system SHALL compute siblings as a derived view: two entities are siblings if they share a `parent_of` parent (in either the relationships table or via canonical containment FK — `portfolio_id` for projects, `parent_id` for work items, `project_id` ordering for unrelated items).

#### Scenario: Two work items under the same parent are siblings
- **WHEN** work items B and C both have `parent_id = A`
- **THEN** the system SHALL return each as a sibling of the other on the relationship panel under "Siblings"

#### Scenario: Items connected only via relationships parent_of are still siblings
- **WHEN** `A parent_of B` and `A parent_of C` exist in the relationships table (no shared `parent_id` FK)
- **THEN** the system SHALL treat B and C as siblings

### Requirement: Containment FKs remain canonical
The system SHALL keep `portfolio_id`, `project_id`, and work-item `parent_id` FKs as the canonical containment hierarchy. The `relationships` table SHALL add the non-canonical edges (cross-project parent, cross-portfolio dependencies, sibling-by-tag, etc.) without duplicating the FK relationships.

#### Scenario: Don't double-store containment as parent_of
- **WHEN** a project is created within a portfolio (`portfolio_id` set)
- **THEN** the system SHALL NOT insert a corresponding `parent_of` row in `relationships`; the FK alone represents containment

#### Scenario: Cross-container parent_of allowed
- **WHEN** a client creates `parent_of` from work item A in project P1 to work item B in project P2
- **THEN** the system SHALL persist it in `relationships` (since the canonical `parent_id` FK cannot cross projects)

### Requirement: Relationship API
The system SHALL expose REST endpoints: `POST /api/v1/relationships`, `DELETE /api/v1/relationships/:id`, `GET /api/v1/entities/:type/:id/relationships` (returns relationships grouped by `type`, including computed inverses and siblings).

#### Scenario: Fetch all relationships for an entity
- **WHEN** a client GETs `/api/v1/entities/work_item/wi-abc/relationships`
- **THEN** the response SHALL include arrays keyed by relationship type (`parent_of`, `child_of`, `blocks`, `blocked_by`, ..., `siblings`) each containing the adjacent entity summaries (id, type, title)

### Requirement: Relationship UI panel
The system SHALL render a "Related" panel on every portfolio, project, and work-item detail page showing relationships grouped by type, with inline "Add relationship" controls (entity picker + type selector).

#### Scenario: Add a blocks relationship from the UI
- **WHEN** a user on a work-item detail page clicks "Add relationship", selects type `blocks`, picks target work item B, and confirms
- **THEN** the system SHALL POST to the relationships API and re-render the panel with B under "Blocks"

### Requirement: Graph view
The system SHALL provide a per-entity graph visualization showing the entity at center with two hops of relationships rendered as a node-edge diagram. Per design Decision 18, depth is fixed at 2 hops — no toggle clutter; users requiring deeper exploration navigate by clicking through nodes.

#### Scenario: View 2-hop graph
- **WHEN** a user clicks "Graph view" on a work item with three direct relationships and ten transitive
- **THEN** the system SHALL render a graph diagram with the work item centered, three first-hop nodes, and up to ten second-hop nodes; clicking any node SHALL navigate to that entity's detail page (making it the new center of a fresh 2-hop view)

### Requirement: Relationships scoped by access
The system SHALL only return relationships whose source AND target are visible to the current user under `user_id` scoping (single-user mode: all relationships owned by `local-user`).

#### Scenario: Multi-user readiness — cross-user relationships not leaked
- **WHEN** in a hypothetical multi-user context, a client queries relationships for entity X
- **THEN** the response SHALL exclude any relationship whose target the current user cannot see
