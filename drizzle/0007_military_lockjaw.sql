CREATE TABLE `atlas_herald` (
	`owner` text PRIMARY KEY NOT NULL,
	`items` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`imported_at` text,
	`source_exported_at` text
);

--> statement-breakpoint
CREATE TRIGGER atlas_history_herald_insert AFTER INSERT ON atlas_herald BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'herald','herald','created',NULL,json_object('revision',NEW.revision,'item_count',json_array_length(NEW.items),'active_items',(SELECT count(*) FROM json_each(NEW.items) WHERE json_extract(value,'$.archived')=0),'updated_at',NEW.updated_at,'source_exported_at',NEW.source_exported_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
CREATE TRIGGER atlas_history_herald_update AFTER UPDATE ON atlas_herald BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'herald','herald','updated',json_object('revision',OLD.revision,'item_count',json_array_length(OLD.items),'active_items',(SELECT count(*) FROM json_each(OLD.items) WHERE json_extract(value,'$.archived')=0),'updated_at',OLD.updated_at,'source_exported_at',OLD.source_exported_at),json_object('revision',NEW.revision,'item_count',json_array_length(NEW.items),'active_items',(SELECT count(*) FROM json_each(NEW.items) WHERE json_extract(value,'$.archived')=0),'updated_at',NEW.updated_at,'source_exported_at',NEW.source_exported_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
CREATE TRIGGER atlas_history_herald_delete AFTER DELETE ON atlas_herald BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'herald','herald','removed',json_object('revision',OLD.revision,'item_count',json_array_length(OLD.items),'active_items',(SELECT count(*) FROM json_each(OLD.items) WHERE json_extract(value,'$.archived')=0),'updated_at',OLD.updated_at,'source_exported_at',OLD.source_exported_at),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
