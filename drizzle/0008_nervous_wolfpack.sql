CREATE TABLE `atlas_cadence` (
	`owner` text PRIMARY KEY NOT NULL,
	`routines` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`imported_at` text,
	`source_exported_at` text
);
--> statement-breakpoint
ALTER TABLE `atlas_tasks` ADD `routine_id` text;--> statement-breakpoint
ALTER TABLE `atlas_tasks` ADD `occurrence_date` text;--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_tasks_routine_occurrence` ON `atlas_tasks` (`owner`,`routine_id`,`occurrence_date`);
--> statement-breakpoint
CREATE TRIGGER atlas_history_cadence_insert AFTER INSERT ON atlas_cadence BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'cadence','cadence','created',NULL,json_object('revision',NEW.revision,'routine_count',json_array_length(NEW.routines),'active_routines',(SELECT count(*) FROM json_each(NEW.routines) WHERE json_extract(value,'$.paused')=0),'updated_at',NEW.updated_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
CREATE TRIGGER atlas_history_cadence_update AFTER UPDATE ON atlas_cadence BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'cadence','cadence','updated',json_object('revision',OLD.revision,'routine_count',json_array_length(OLD.routines),'active_routines',(SELECT count(*) FROM json_each(OLD.routines) WHERE json_extract(value,'$.paused')=0),'updated_at',OLD.updated_at),json_object('revision',NEW.revision,'routine_count',json_array_length(NEW.routines),'active_routines',(SELECT count(*) FROM json_each(NEW.routines) WHERE json_extract(value,'$.paused')=0),'updated_at',NEW.updated_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
CREATE TRIGGER atlas_history_cadence_delete AFTER DELETE ON atlas_cadence BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'cadence','cadence','removed',json_object('revision',OLD.revision,'routine_count',json_array_length(OLD.routines),'active_routines',(SELECT count(*) FROM json_each(OLD.routines) WHERE json_extract(value,'$.paused')=0),'updated_at',OLD.updated_at),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
