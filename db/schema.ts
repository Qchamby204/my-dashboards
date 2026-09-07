import { sqliteTable, text, integer, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('atlas_projects', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), sourceId: text('source_id').notNull(),
  title: text('title').notNull(), area: text('area').notNull(), status: text('status').notNull(),
  dueDate: text('due_date'), importedAt: text('imported_at').notNull(),
  mode: text('mode').notNull().default('snapshot'), revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at'), completedAt: text('completed_at'), archivedAt: text('archived_at'),
}, t => [uniqueIndex('atlas_projects_owner_source').on(t.owner, t.sourceId)]);

export const tasks = sqliteTable('atlas_tasks', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), title: text('title').notNull(),
  appId: text('app_id').notNull().default('life-map'), projectId: text('project_id'),
  weekStart: text('week_start'), dueDate: text('due_date'), minutes: integer('minutes').notNull().default(30),
  focusDate: text('focus_date'), focusSlot: integer('focus_slot'),
  status: text('status').notNull().default('open'), completedAt: text('completed_at'),
  revision: integer('revision').notNull().default(1), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [index('atlas_tasks_owner_week').on(t.owner, t.weekStart),
  uniqueIndex('atlas_tasks_focus_slot').on(t.owner, t.focusDate, t.focusSlot).where(sql`${t.focusDate} IS NOT NULL`)]);

export const weeks = sqliteTable('atlas_weeks', {
  id: text('id').primaryKey(), owner: text('owner').notNull(), weekStart: text('week_start').notNull(),
  capacity: integer('capacity').notNull().default(600), worked: text('worked').notNull().default(''),
  change: text('change').notNull().default(''), revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull(),
}, t => [uniqueIndex('atlas_weeks_owner_start').on(t.owner, t.weekStart)]);

export const practiceSnapshots = sqliteTable('atlas_practice_snapshots', {
  owner: text('owner').primaryKey(), items: text('items').notNull(),
  revision: integer('revision').notNull().default(1), importedAt: text('imported_at').notNull(),
  sourceExportedAt: text('source_exported_at'),
  mode: text('mode').notNull().default('snapshot'), catalog: text('catalog').notNull().default('[]'),
  updatedAt: text('updated_at'),
  editionRefresh: text('edition_refresh'),
});

export const ledger = sqliteTable('atlas_ledger', {
  owner: text('owner').primaryKey(), habits: text('habits').notNull(), days: text('days').notNull(),
  revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull(),
  importedAt: text('imported_at'), sourceExportedAt: text('source_exported_at'),
});

export const communication = sqliteTable('atlas_communication', {
  owner: text('owner').primaryKey(), reps: text('reps').notNull(),
  revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull(),
  importedAt: text('imported_at'), sourceExportedAt: text('source_exported_at'),
});

export const history = sqliteTable('atlas_history', {
  seq: integer('seq').primaryKey({autoIncrement:true}), owner:text('owner').notNull(),
  entity:text('entity').notNull(), recordId:text('record_id').notNull(), action:text('action').notNull(),
  before:text('before_json'), after:text('after_json'), createdAt:text('created_at').notNull(),
}, t=>[index('atlas_history_owner_seq').on(t.owner,t.seq)]);
export const checkpoints = sqliteTable('atlas_checkpoints', {
  id:text('id').primaryKey(), owner:text('owner').notNull(), createdAt:text('created_at').notNull(),
  afterSeq:integer('after_seq').notNull(), label:text('label').notNull(),
},t=>[index('atlas_checkpoints_owner').on(t.owner)]);
export const checkpointChunks = sqliteTable('atlas_checkpoint_chunks', {
  id:text('id').primaryKey(), checkpointId:text('checkpoint_id').notNull(), content:text('content').notNull(), position:integer('position').notNull(),
},t=>[uniqueIndex('atlas_checkpoint_chunk_position').on(t.checkpointId,t.position)]);
// A failed guard aborts the entire D1 batch before any restore writes.
export const restoreGuards = sqliteTable('atlas_restore_guards', {
  id:text('id').primaryKey(), valid:integer('valid').notNull(),
},t=>[check('atlas_restore_guard_valid',sql`${t.valid} = 1`)]);

export const herald = sqliteTable('atlas_herald', {
  owner: text('owner').primaryKey(), items: text('items').notNull(),
  revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull(),
  importedAt: text('imported_at'), sourceExportedAt: text('source_exported_at'),
});
