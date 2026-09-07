CREATE TABLE `atlas_practice_snapshots` (
	`owner` text PRIMARY KEY NOT NULL,
	`items` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`imported_at` text NOT NULL,
	`source_exported_at` text
);
--> statement-breakpoint
ALTER TABLE `atlas_projects` ADD `mode` text DEFAULT 'snapshot' NOT NULL;--> statement-breakpoint
ALTER TABLE `atlas_projects` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `atlas_projects` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `atlas_projects` ADD `completed_at` text;--> statement-breakpoint
ALTER TABLE `atlas_projects` ADD `archived_at` text;