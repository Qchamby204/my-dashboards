CREATE TABLE `atlas_communication` (
	`owner` text PRIMARY KEY NOT NULL,
	`reps` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`imported_at` text,
	`source_exported_at` text
);

--> statement-breakpoint
CREATE TRIGGER atlas_history_communication_insert AFTER INSERT ON atlas_communication BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'communication','communication','created',NULL,json_object('revision',NEW.revision,'rep_count',json_array_length(NEW.reps),'active_reps',(SELECT count(*) FROM json_each(NEW.reps) WHERE json_extract(value,'$.archived')=0),'updated_at',NEW.updated_at,'source_exported_at',NEW.source_exported_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
CREATE TRIGGER atlas_history_communication_update AFTER UPDATE ON atlas_communication BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'communication','communication','updated',json_object('revision',OLD.revision,'rep_count',json_array_length(OLD.reps),'active_reps',(SELECT count(*) FROM json_each(OLD.reps) WHERE json_extract(value,'$.archived')=0),'updated_at',OLD.updated_at,'source_exported_at',OLD.source_exported_at),json_object('revision',NEW.revision,'rep_count',json_array_length(NEW.reps),'active_reps',(SELECT count(*) FROM json_each(NEW.reps) WHERE json_extract(value,'$.archived')=0),'updated_at',NEW.updated_at,'source_exported_at',NEW.source_exported_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
CREATE TRIGGER atlas_history_communication_delete AFTER DELETE ON atlas_communication BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'communication','communication','removed',json_object('revision',OLD.revision,'rep_count',json_array_length(OLD.reps),'active_reps',(SELECT count(*) FROM json_each(OLD.reps) WHERE json_extract(value,'$.archived')=0),'updated_at',OLD.updated_at,'source_exported_at',OLD.source_exported_at),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
