import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
});
