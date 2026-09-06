CREATE TABLE `atlas_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`source_id` text NOT NULL,
	`title` text NOT NULL,
	`area` text NOT NULL,
	`status` text NOT NULL,
	`due_date` text,
	`imported_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_projects_owner_source` ON `atlas_projects` (`owner`,`source_id`);--> statement-breakpoint
CREATE TABLE `atlas_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`app_id` text DEFAULT 'life-map' NOT NULL,
	`project_id` text,
	`week_start` text,
	`due_date` text,
	`minutes` integer DEFAULT 30 NOT NULL,
	`focus_date` text,
	`focus_slot` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`completed_at` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `atlas_tasks_owner_week` ON `atlas_tasks` (`owner`,`week_start`);--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_tasks_focus_slot` ON `atlas_tasks` (`owner`,`focus_date`,`focus_slot`) WHERE "atlas_tasks"."focus_date" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `atlas_weeks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`week_start` text NOT NULL,
	`capacity` integer DEFAULT 600 NOT NULL,
	`worked` text DEFAULT '' NOT NULL,
	`change` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_weeks_owner_start` ON `atlas_weeks` (`owner`,`week_start`);