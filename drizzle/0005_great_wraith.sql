ALTER TABLE `atlas_practice_snapshots` ADD `edition_refresh` text;
--> statement-breakpoint
DROP TRIGGER atlas_history_practice_snapshots_insert;
--> statement-breakpoint
CREATE TRIGGER atlas_history_practice_snapshots_insert AFTER INSERT ON atlas_practice_snapshots BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'practice_snapshots','practice','created',NULL,json_object('revision', NEW.revision, 'imported_at', NEW.imported_at, 'source_exported_at', NEW.source_exported_at, 'count', json_array_length(NEW.items), 'mode', NEW.mode, 'lessons', json_array_length(NEW.catalog), 'updated_at', NEW.updated_at, 'feed_checked_at', json_extract(NEW.edition_refresh,'$.checked_at')),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
DROP TRIGGER atlas_history_practice_snapshots_update;
--> statement-breakpoint
CREATE TRIGGER atlas_history_practice_snapshots_update AFTER UPDATE ON atlas_practice_snapshots BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'practice_snapshots','practice','updated',json_object('revision', OLD.revision, 'imported_at', OLD.imported_at, 'source_exported_at', OLD.source_exported_at, 'count', json_array_length(OLD.items), 'mode', OLD.mode, 'lessons', json_array_length(OLD.catalog), 'updated_at', OLD.updated_at, 'feed_checked_at', json_extract(OLD.edition_refresh,'$.checked_at')),json_object('revision', NEW.revision, 'imported_at', NEW.imported_at, 'source_exported_at', NEW.source_exported_at, 'count', json_array_length(NEW.items), 'mode', NEW.mode, 'lessons', json_array_length(NEW.catalog), 'updated_at', NEW.updated_at, 'feed_checked_at', json_extract(NEW.edition_refresh,'$.checked_at')),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

--> statement-breakpoint
DROP TRIGGER atlas_history_practice_snapshots_delete;
--> statement-breakpoint
CREATE TRIGGER atlas_history_practice_snapshots_delete AFTER DELETE ON atlas_practice_snapshots BEGIN
 INSERT INTO atlas_history (owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'practice_snapshots','practice','removed',json_object('revision', OLD.revision, 'imported_at', OLD.imported_at, 'source_exported_at', OLD.source_exported_at, 'count', json_array_length(OLD.items), 'mode', OLD.mode, 'lessons', json_array_length(OLD.catalog), 'updated_at', OLD.updated_at, 'feed_checked_at', json_extract(OLD.edition_refresh,'$.checked_at')),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
