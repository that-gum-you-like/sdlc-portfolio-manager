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
