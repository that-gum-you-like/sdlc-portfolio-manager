import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { v4 as uuid } from 'uuid';

const id = () => text('id').primaryKey().$defaultFn(() => uuid());
const userId = () => text('user_id').notNull().default('local-user');
const createdAt = () =>
  text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString());
const updatedAt = () =>
  text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString());

export const portfolios = sqliteTable('portfolios', {
  id: id(),
  userId: userId(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const projects = sqliteTable(
  'projects',
  {
    id: id(),
    portfolioId: text('portfolio_id')
      .notNull()
      .references(() => portfolios.id, { onDelete: 'cascade' }),
    userId: userId(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    targetRepoPath: text('target_repo_path'),
    settingsJson: text('settings_json')
      .notNull()
      .default(sql`'{}'`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    slugPerPortfolio: uniqueIndex('projects_portfolio_slug_unique').on(t.portfolioId, t.slug),
  }),
);

export const libraryEntries = sqliteTable('library_entries', {
  id: id(),
  userId: userId(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['rule', 'skill', 'automation', 'validator', 'doc'],
  }).notNull(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  filePath: text('file_path').notNull(),
  frontmatterJson: text('frontmatter_json')
    .notNull()
    .default(sql`'{}'`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const workItems = sqliteTable('work_items', {
  id: id(),
  userId: userId(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  parentId: text('parent_id'),
  type: text('type', {
    enum: ['epic', 'story', 'task', 'bug', 'requirement', 'roadmap-item', 'parallelization-stream', 'devlog-entry'],
  }).notNull(),
  status: text('status', {
    enum: ['backlog', 'ready', 'in_progress', 'needs-human', 'in_review', 'done', 'cancelled'],
  })
    .notNull()
    .default('backlog'),
  previousStatus: text('previous_status'),
  title: text('title').notNull(),
  description: text('description'),
  assignee: text('assignee'),
  rank: integer('rank').notNull().default(0),
  labels: text('labels')
    .notNull()
    .default(sql`'[]'`),
  acceptanceCriteria: text('acceptance_criteria')
    .notNull()
    .default(sql`'[]'`),
  subtypeData: text('subtype_data')
    .notNull()
    .default(sql`'{}'`),
  sourceDiscoveryId: text('source_discovery_id'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const comments = sqliteTable('comments', {
  id: id(),
  userId: userId(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  workItemId: text('work_item_id')
    .notNull()
    .references(() => workItems.id, { onDelete: 'cascade' }),
  author: text('author').notNull(),
  body: text('body').notNull(),
  kind: text('kind', { enum: ['note', 'evidence'] }).notNull().default('note'),
  criterionId: text('criterion_id'),
  createdAt: createdAt(),
});

export const relationships = sqliteTable(
  'relationships',
  {
    id: id(),
    userId: userId(),
    sourceType: text('source_type', { enum: ['portfolio', 'project', 'work_item'] }).notNull(),
    sourceId: text('source_id').notNull(),
    targetType: text('target_type', { enum: ['portfolio', 'project', 'work_item'] }).notNull(),
    targetId: text('target_id').notNull(),
    type: text('type', {
      enum: ['parent_of', 'blocks', 'depends_on', 'duplicates', 'related_to', 'predecessor_of'],
    }).notNull(),
    note: text('note'),
    createdBy: text('created_by'),
    createdAt: createdAt(),
  },
  (t) => ({
    uniqueEdge: uniqueIndex('relationships_edge_unique').on(
      t.sourceType,
      t.sourceId,
      t.targetType,
      t.targetId,
      t.type,
    ),
  }),
);

export const questions = sqliteTable('questions', {
  id: id(),
  userId: userId(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  workItemId: text('work_item_id')
    .notNull()
    .references(() => workItems.id, { onDelete: 'cascade' }),
  askedBy: text('asked_by').notNull(),
  addressedTo: text('addressed_to'),
  body: text('body').notNull(),
  status: text('status', { enum: ['open', 'answered', 'cancelled'] })
    .notNull()
    .default('open'),
  previousStatus: text('previous_status').notNull(),
  askedAt: text('asked_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  answeredAt: text('answered_at'),
  answerId: text('answer_id').references(() => comments.id, { onDelete: 'set null' }),
});

export const mentions = sqliteTable('mentions', {
  id: id(),
  userId: userId(),
  sourceType: text('source_type', { enum: ['comment', 'question'] }).notNull(),
  sourceId: text('source_id').notNull(),
  workItemId: text('work_item_id').references(() => workItems.id, { onDelete: 'cascade' }),
  mentionedHandle: text('mentioned_handle').notNull(),
  resolvedUserId: text('resolved_user_id'),
  resolvedAgentName: text('resolved_agent_name'),
  createdAt: createdAt(),
});

export const notifications = sqliteTable('notifications', {
  id: id(),
  userId: userId(),
  recipient: text('recipient').notNull(),
  kind: text('kind', { enum: ['mention', 'question', 'answer'] }).notNull(),
  sourceId: text('source_id').notNull(),
  workItemId: text('work_item_id').references(() => workItems.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
  readAt: text('read_at'),
});

export const evidenceLinks = sqliteTable('evidence_links', {
  id: id(),
  userId: userId(),
  commentId: text('comment_id')
    .notNull()
    .references(() => comments.id, { onDelete: 'cascade' }),
  acceptanceCriterionId: text('acceptance_criterion_id').notNull(),
  criterionTextSnapshot: text('criterion_text_snapshot'),
  workItemId: text('work_item_id')
    .notNull()
    .references(() => workItems.id, { onDelete: 'cascade' }),
  createdAt: createdAt(),
});

export const discoveries = sqliteTable('discoveries', {
  id: id(),
  userId: userId(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  rawDump: text('raw_dump').notNull(),
  source: text('source', {
    enum: ['text', 'voice-transcript', 'meeting-notes', 'email'],
  })
    .notNull()
    .default('text'),
  status: text('status', {
    enum: ['draft', 'generating', 'reviewing', 'accepted', 'archived'],
  })
    .notNull()
    .default('draft'),
  generationRequested: integer('generation_requested', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  acceptedAt: text('accepted_at'),
});

export const discoveryDrafts = sqliteTable('discovery_drafts', {
  id: id(),
  userId: userId(),
  discoveryId: text('discovery_id')
    .notNull()
    .references(() => discoveries.id, { onDelete: 'cascade' }),
  draftType: text('draft_type', {
    enum: [
      'epic',
      'story',
      'task',
      'bug',
      'requirement',
      'roadmap-item',
      'parallelization-stream',
      'devlog-entry',
    ],
  }).notNull(),
  draftData: text('draft_data')
    .notNull()
    .default(sql`'{}'`),
  parentDraftId: text('parent_draft_id'),
  relationshipDrafts: text('relationship_drafts')
    .notNull()
    .default(sql`'[]'`),
  status: text('status', { enum: ['pending', 'accepted', 'rejected', 'edited'] })
    .notNull()
    .default('pending'),
  resultingWorkItemId: text('resulting_work_item_id').references(() => workItems.id, {
    onDelete: 'set null',
  }),
  generatedBy: text('generated_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const validationRuns = sqliteTable('validation_runs', {
  id: id(),
  userId: userId(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  workItemId: text('work_item_id')
    .notNull()
    .references(() => workItems.id, { onDelete: 'cascade' }),
  gate: text('gate', {
    enum: ['quality', 'security', 'bugs', 'user-story-acceptance'],
  }).notNull(),
  validatorSlug: text('validator_slug').notNull(),
  startedAt: text('started_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  completedAt: text('completed_at'),
  status: text('status', {
    enum: ['running', 'pass', 'fail', 'error', 'skipped'],
  })
    .notNull()
    .default('running'),
  exitCode: integer('exit_code'),
  stdoutSnippet: text('stdout_snippet'),
  stderrSnippet: text('stderr_snippet'),
  findingsJson: text('findings_json')
    .notNull()
    .default(sql`'{}'`),
});

export const overrides = sqliteTable('overrides', {
  id: id(),
  userId: userId(),
  workItemId: text('work_item_id')
    .notNull()
    .references(() => workItems.id, { onDelete: 'cascade' }),
  failingGatesJson: text('failing_gates_json')
    .notNull()
    .default(sql`'[]'`),
  reason: text('reason').notNull(),
  submittedBy: text('submitted_by').notNull(),
  submittedAt: text('submitted_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const publishHistory = sqliteTable('publish_history', {
  id: id(),
  userId: userId(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
  entryType: text('entry_type', {
    enum: ['rule', 'skill', 'automation', 'validator', 'doc'],
  }).notNull(),
  entrySlug: text('entry_slug').notNull(),
  targetRepoPath: text('target_repo_path').notNull(),
  writtenPath: text('written_path').notNull(),
  sourcePath: text('source_path').notNull(),
  overwrote: integer('overwrote', { mode: 'boolean' }).notNull().default(false),
  writtenBy: text('written_by'),
  createdAt: createdAt(),
});

export const automationRuns = sqliteTable('automation_runs', {
  id: id(),
  userId: userId(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  automationEntryId: text('automation_entry_id'),
  automationSlug: text('automation_slug'),
  startedAt: text('started_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  completedAt: text('completed_at'),
  status: text('status', { enum: ['running', 'completed', 'failed', 'cancelled'] })
    .notNull()
    .default('running'),
  summary: text('summary'),
  createdItemIdsJson: text('created_item_ids_json')
    .notNull()
    .default(sql`'[]'`),
});

export const migrations = sqliteTable('_migrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  appliedAt: createdAt(),
});

export type Portfolio = typeof portfolios.$inferSelect;
export type NewPortfolio = typeof portfolios.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type WorkItem = typeof workItems.$inferSelect;
export type NewWorkItem = typeof workItems.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type LibraryEntry = typeof libraryEntries.$inferSelect;
export type Relationship = typeof relationships.$inferSelect;
export type Mention = typeof mentions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type EvidenceLink = typeof evidenceLinks.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type AutomationRun = typeof automationRuns.$inferSelect;
export type NewAutomationRun = typeof automationRuns.$inferInsert;
export type Discovery = typeof discoveries.$inferSelect;
export type NewDiscovery = typeof discoveries.$inferInsert;
export type DiscoveryDraft = typeof discoveryDrafts.$inferSelect;
export type NewDiscoveryDraft = typeof discoveryDrafts.$inferInsert;
export type PublishHistoryRow = typeof publishHistory.$inferSelect;
export type NewPublishHistoryRow = typeof publishHistory.$inferInsert;
export type ValidationRun = typeof validationRuns.$inferSelect;
export type NewValidationRun = typeof validationRuns.$inferInsert;
export type OverrideRow = typeof overrides.$inferSelect;
export type NewOverrideRow = typeof overrides.$inferInsert;
