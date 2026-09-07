CREATE TABLE `atlas_ledger` (
	`owner` text PRIMARY KEY NOT NULL,
	`habits` text NOT NULL,
	`days` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`imported_at` text,
	`source_exported_at` text
);

--> statement-breakpoint
CREATE TRIGGER atlas_history_ledger_insert AFTER INSERT ON atlas_ledger BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'ledger','ledger','created',NULL,json_object('revision',NEW.revision,'habit_count',json_array_length(NEW.habits),'day_count',json_array_length(NEW.days),'updated_at',NEW.updated_at,'source_exported_at',NEW.source_exported_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
CREATE TRIGGER atlas_history_ledger_update AFTER UPDATE ON atlas_ledger BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'ledger','ledger','updated',json_object('revision',OLD.revision,'habit_count',json_array_length(OLD.habits),'day_count',json_array_length(OLD.days),'updated_at',OLD.updated_at,'source_exported_at',OLD.source_exported_at),json_object('revision',NEW.revision,'habit_count',json_array_length(NEW.habits),'day_count',json_array_length(NEW.days),'updated_at',NEW.updated_at,'source_exported_at',NEW.source_exported_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
CREATE TRIGGER atlas_history_ledger_delete AFTER DELETE ON atlas_ledger BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'ledger','ledger','removed',json_object('revision',OLD.revision,'habit_count',json_array_length(OLD.habits),'day_count',json_array_length(OLD.days),'updated_at',OLD.updated_at,'source_exported_at',OLD.source_exported_at),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
