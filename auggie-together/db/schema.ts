import { tummyObservations } from '../lib/tummy-observations';
import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const events = sqliteTable('care_events', {
  id: text('id').primaryKey(), kind: text('kind').notNull(), subtype: text('subtype').notNull().default(''), soiledSize: text('soiled_size'), wetSize: text('wet_size'), milkStorage: text('milk_storage'), milkDeadline: text('milk_deadline'),
  startedAt: text('started_at').notNull(), endedAt: text('ended_at'), amount: real('amount'), offered: real('offered'), duration: real('duration'),
  tummyObservation: text('tummy_observation', { enum: tummyObservations }),
  tummyCueSeconds: integer('tummy_cue_seconds'), tummyComfort: text('tummy_comfort', { enum: ['comfortable', 'break'] }),
  notes: text('notes').notNull().default(''), actor: text('actor').notNull(), creatorId: text('creator_id').notNull(), updatedBy: text('updated_by').notNull(),
  version: integer('version').notNull().default(1), deleted: integer('deleted').notNull().default(0), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, (t) => [index('events_time').on(t.startedAt), index('events_kind_time').on(t.kind,t.startedAt),uniqueIndex('one_active_sleep').on(t.kind).where(sql`${t.kind} = 'sleep' AND ${t.endedAt} IS NULL AND ${t.deleted} = 0`), uniqueIndex('one_active_movement_per_kind').on(t.kind).where(sql`${t.kind} IN ('tummy', 'exercise') AND ${t.endedAt} IS NULL AND ${t.deleted} = 0`)]);
export const settings = sqliteTable('care_settings', { id:integer('id').primaryKey(),data:text('data').notNull(),version:integer('version').notNull().default(1) });
