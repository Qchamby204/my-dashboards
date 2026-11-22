CREATE TABLE `care_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`subtype` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`amount` real,
	`offered` real,
	`duration` real,
	`notes` text DEFAULT '' NOT NULL,
	`actor` text NOT NULL,
	`creator_id` text NOT NULL,
	`updated_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_time` ON `care_events` (`started_at`);--> statement-breakpoint
CREATE INDEX `events_kind_time` ON `care_events` (`kind`,`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_sleep` ON `care_events` (`kind`) WHERE "care_events"."kind" = 'sleep' AND "care_events"."ended_at" IS NULL AND "care_events"."deleted" = 0;--> statement-breakpoint
CREATE TABLE `care_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
