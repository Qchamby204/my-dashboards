CREATE TABLE `atlas_checkpoint_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`checkpoint_id` text NOT NULL,
	`content` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_checkpoint_chunk_position` ON `atlas_checkpoint_chunks` (`checkpoint_id`,`position`);--> statement-breakpoint
CREATE TABLE `atlas_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created_at` text NOT NULL,
	`after_seq` integer NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `atlas_checkpoints_owner` ON `atlas_checkpoints` (`owner`);--> statement-breakpoint
CREATE TABLE `atlas_history` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner` text NOT NULL,
	`entity` text NOT NULL,
	`record_id` text NOT NULL,
	`action` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `atlas_history_owner_seq` ON `atlas_history` (`owner`,`seq`);--> statement-breakpoint
CREATE TABLE `atlas_restore_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`valid` integer NOT NULL,
	CONSTRAINT "atlas_restore_guard_valid" CHECK("atlas_restore_guards"."valid" = 1)
);

--> statement-breakpoint
CREATE TRIGGER atlas_history_tasks_insert AFTER INSERT ON atlas_tasks BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'tasks',NEW.id,'created',NULL,json_object('id', NEW.id, 'title', NEW.title, 'app_id', NEW.app_id, 'project_id', NEW.project_id, 'week_start', NEW.week_start, 'due_date', NEW.due_date, 'minutes', NEW.minutes, 'focus_date', NEW.focus_date, 'focus_slot', NEW.focus_slot, 'status', NEW.status, 'completed_at', NEW.completed_at, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_tasks_update AFTER UPDATE ON atlas_tasks BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'tasks',NEW.id,'updated',json_object('id', OLD.id, 'title', OLD.title, 'app_id', OLD.app_id, 'project_id', OLD.project_id, 'week_start', OLD.week_start, 'due_date', OLD.due_date, 'minutes', OLD.minutes, 'focus_date', OLD.focus_date, 'focus_slot', OLD.focus_slot, 'status', OLD.status, 'completed_at', OLD.completed_at, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at),json_object('id', NEW.id, 'title', NEW.title, 'app_id', NEW.app_id, 'project_id', NEW.project_id, 'week_start', NEW.week_start, 'due_date', NEW.due_date, 'minutes', NEW.minutes, 'focus_date', NEW.focus_date, 'focus_slot', NEW.focus_slot, 'status', NEW.status, 'completed_at', NEW.completed_at, 'revision', NEW.revision, 'created_at', NEW.created_at, 'updated_at', NEW.updated_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_tasks_delete AFTER DELETE ON atlas_tasks BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'tasks',OLD.id,'removed',json_object('id', OLD.id, 'title', OLD.title, 'app_id', OLD.app_id, 'project_id', OLD.project_id, 'week_start', OLD.week_start, 'due_date', OLD.due_date, 'minutes', OLD.minutes, 'focus_date', OLD.focus_date, 'focus_slot', OLD.focus_slot, 'status', OLD.status, 'completed_at', OLD.completed_at, 'revision', OLD.revision, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_projects_insert AFTER INSERT ON atlas_projects BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'projects',NEW.id,'created',NULL,json_object('id', NEW.id, 'source_id', NEW.source_id, 'title', NEW.title, 'area', NEW.area, 'status', NEW.status, 'due_date', NEW.due_date, 'imported_at', NEW.imported_at, 'mode', NEW.mode, 'revision', NEW.revision, 'updated_at', NEW.updated_at, 'completed_at', NEW.completed_at, 'archived_at', NEW.archived_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_projects_update AFTER UPDATE ON atlas_projects BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'projects',NEW.id,'updated',json_object('id', OLD.id, 'source_id', OLD.source_id, 'title', OLD.title, 'area', OLD.area, 'status', OLD.status, 'due_date', OLD.due_date, 'imported_at', OLD.imported_at, 'mode', OLD.mode, 'revision', OLD.revision, 'updated_at', OLD.updated_at, 'completed_at', OLD.completed_at, 'archived_at', OLD.archived_at),json_object('id', NEW.id, 'source_id', NEW.source_id, 'title', NEW.title, 'area', NEW.area, 'status', NEW.status, 'due_date', NEW.due_date, 'imported_at', NEW.imported_at, 'mode', NEW.mode, 'revision', NEW.revision, 'updated_at', NEW.updated_at, 'completed_at', NEW.completed_at, 'archived_at', NEW.archived_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_projects_delete AFTER DELETE ON atlas_projects BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'projects',OLD.id,'removed',json_object('id', OLD.id, 'source_id', OLD.source_id, 'title', OLD.title, 'area', OLD.area, 'status', OLD.status, 'due_date', OLD.due_date, 'imported_at', OLD.imported_at, 'mode', OLD.mode, 'revision', OLD.revision, 'updated_at', OLD.updated_at, 'completed_at', OLD.completed_at, 'archived_at', OLD.archived_at),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_weeks_insert AFTER INSERT ON atlas_weeks BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'weeks',NEW.id,'created',NULL,json_object('id', NEW.id, 'week_start', NEW.week_start, 'capacity', NEW.capacity, 'worked', NEW.worked, 'change', NEW.change, 'revision', NEW.revision, 'updated_at', NEW.updated_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_weeks_update AFTER UPDATE ON atlas_weeks BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'weeks',NEW.id,'updated',json_object('id', OLD.id, 'week_start', OLD.week_start, 'capacity', OLD.capacity, 'worked', OLD.worked, 'change', OLD.change, 'revision', OLD.revision, 'updated_at', OLD.updated_at),json_object('id', NEW.id, 'week_start', NEW.week_start, 'capacity', NEW.capacity, 'worked', NEW.worked, 'change', NEW.change, 'revision', NEW.revision, 'updated_at', NEW.updated_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_weeks_delete AFTER DELETE ON atlas_weeks BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'weeks',OLD.id,'removed',json_object('id', OLD.id, 'week_start', OLD.week_start, 'capacity', OLD.capacity, 'worked', OLD.worked, 'change', OLD.change, 'revision', OLD.revision, 'updated_at', OLD.updated_at),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_practice_snapshots_insert AFTER INSERT ON atlas_practice_snapshots BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'practice_snapshots','practice','created',NULL,json_object('revision', NEW.revision, 'imported_at', NEW.imported_at, 'source_exported_at', NEW.source_exported_at, 'count', json_array_length(NEW.items)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_practice_snapshots_update AFTER UPDATE ON atlas_practice_snapshots BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'practice_snapshots','practice','updated',json_object('revision', OLD.revision, 'imported_at', OLD.imported_at, 'source_exported_at', OLD.source_exported_at, 'count', json_array_length(OLD.items)),json_object('revision', NEW.revision, 'imported_at', NEW.imported_at, 'source_exported_at', NEW.source_exported_at, 'count', json_array_length(NEW.items)),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_practice_snapshots_delete AFTER DELETE ON atlas_practice_snapshots BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'practice_snapshots','practice','removed',json_object('revision', OLD.revision, 'imported_at', OLD.imported_at, 'source_exported_at', OLD.source_exported_at, 'count', json_array_length(OLD.items)),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
