CREATE TABLE `atlas_app_states` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`state_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "atlas_app_states_kind" CHECK("atlas_app_states"."kind" IN ('life-map','herald'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_app_states_owner_kind` ON `atlas_app_states` (`owner`,`kind`);--> statement-breakpoint
CREATE TABLE `atlas_priorities` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`record_id` text NOT NULL,
	`day` text NOT NULL,
	`slot` integer NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "atlas_priorities_kind" CHECK("atlas_priorities"."kind" IN ('project','content')),
	CONSTRAINT "atlas_priorities_slot" CHECK("atlas_priorities"."slot" BETWEEN 1 AND 3)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_priorities_owner_record` ON `atlas_priorities` (`owner`,`kind`,`record_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `atlas_priorities_owner_slot` ON `atlas_priorities` (`owner`,`day`,`slot`);
--> statement-breakpoint
CREATE TRIGGER atlas_priority_slot_insert BEFORE INSERT ON atlas_priorities BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM atlas_tasks WHERE owner=NEW.owner AND focus_date=NEW.day AND focus_slot=NEW.slot) THEN RAISE(ABORT,'atlas_priority_conflict') END;
 SELECT CASE WHEN NEW.kind='project' AND NOT EXISTS(SELECT 1 FROM atlas_projects WHERE owner=NEW.owner AND id=NEW.record_id AND status='open' AND archived_at IS NULL) THEN RAISE(ABORT,'atlas_priority_source_changed') END;
 SELECT CASE WHEN NEW.kind='content' AND NOT EXISTS(SELECT 1 FROM atlas_herald,json_each(atlas_herald.items) WHERE owner=NEW.owner AND json_extract(value,'$.id')=NEW.record_id AND json_extract(value,'$.archived')=0 AND json_extract(value,'$.stage')<>'published') THEN RAISE(ABORT,'atlas_priority_source_changed') END;
END;
--> statement-breakpoint
CREATE TRIGGER atlas_task_shared_slot_insert BEFORE INSERT ON atlas_tasks WHEN NEW.focus_date IS NOT NULL BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM atlas_priorities WHERE owner=NEW.owner AND day=NEW.focus_date AND slot=NEW.focus_slot) THEN RAISE(ABORT,'atlas_priority_conflict') END;
END;
--> statement-breakpoint
CREATE TRIGGER atlas_priority_slot_update BEFORE UPDATE ON atlas_priorities BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM atlas_tasks WHERE owner=NEW.owner AND focus_date=NEW.day AND focus_slot=NEW.slot) THEN RAISE(ABORT,'atlas_priority_conflict') END;
 SELECT CASE WHEN NEW.kind='project' AND NOT EXISTS(SELECT 1 FROM atlas_projects WHERE owner=NEW.owner AND id=NEW.record_id AND status='open' AND archived_at IS NULL) THEN RAISE(ABORT,'atlas_priority_source_changed') END;
 SELECT CASE WHEN NEW.kind='content' AND NOT EXISTS(SELECT 1 FROM atlas_herald,json_each(atlas_herald.items) WHERE owner=NEW.owner AND json_extract(value,'$.id')=NEW.record_id AND json_extract(value,'$.archived')=0 AND json_extract(value,'$.stage')<>'published') THEN RAISE(ABORT,'atlas_priority_source_changed') END;
END;
--> statement-breakpoint
CREATE TRIGGER atlas_task_shared_slot_update BEFORE UPDATE ON atlas_tasks WHEN NEW.focus_date IS NOT NULL BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM atlas_priorities WHERE owner=NEW.owner AND day=NEW.focus_date AND slot=NEW.focus_slot) THEN RAISE(ABORT,'atlas_priority_conflict') END;
END;
--> statement-breakpoint
CREATE TRIGGER atlas_project_priority_closed AFTER UPDATE ON atlas_projects WHEN NEW.status<>'open' OR NEW.archived_at IS NOT NULL BEGIN DELETE FROM atlas_priorities WHERE owner=NEW.owner AND kind='project' AND record_id=NEW.id; END;
--> statement-breakpoint
CREATE TRIGGER atlas_project_priority_deleted AFTER DELETE ON atlas_projects BEGIN DELETE FROM atlas_priorities WHERE owner=OLD.owner AND kind='project' AND record_id=OLD.id; END;
--> statement-breakpoint
CREATE TRIGGER atlas_content_priority_closed AFTER UPDATE ON atlas_herald BEGIN DELETE FROM atlas_priorities WHERE owner=NEW.owner AND kind='content' AND NOT EXISTS(SELECT 1 FROM json_each(NEW.items) WHERE json_extract(value,'$.id')=atlas_priorities.record_id AND json_extract(value,'$.stage')<>'published' AND json_extract(value,'$.archived')=0); END;
--> statement-breakpoint
CREATE TRIGGER atlas_content_priority_deleted AFTER DELETE ON atlas_herald BEGIN DELETE FROM atlas_priorities WHERE owner=OLD.owner AND kind='content'; END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_priorities_insert AFTER INSERT ON atlas_priorities BEGIN
 INSERT INTO atlas_history(owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'priorities',NEW.id,'created',NULL,json_object('kind',NEW.kind,'record_id',NEW.record_id,'day',NEW.day,'slot',NEW.slot,'revision',NEW.revision,'updated_at',NEW.updated_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_priorities_update AFTER UPDATE ON atlas_priorities BEGIN
 INSERT INTO atlas_history(owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'priorities',NEW.id,'updated',json_object('kind',OLD.kind,'record_id',OLD.record_id,'day',OLD.day,'slot',OLD.slot,'revision',OLD.revision,'updated_at',OLD.updated_at),json_object('kind',NEW.kind,'record_id',NEW.record_id,'day',NEW.day,'slot',NEW.slot,'revision',NEW.revision,'updated_at',NEW.updated_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_priorities_delete AFTER DELETE ON atlas_priorities BEGIN
 INSERT INTO atlas_history(owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'priorities',OLD.id,'removed',json_object('kind',OLD.kind,'record_id',OLD.record_id,'day',OLD.day,'slot',OLD.slot,'revision',OLD.revision,'updated_at',OLD.updated_at),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_app_states_insert AFTER INSERT ON atlas_app_states BEGIN
 INSERT INTO atlas_history(owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'app_states',NEW.id,'created',NULL,json_object('kind',NEW.kind,'revision',NEW.revision,'updated_at',NEW.updated_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_app_states_update AFTER UPDATE ON atlas_app_states BEGIN
 INSERT INTO atlas_history(owner,entity,record_id,action,before_json,after_json,created_at) VALUES (NEW.owner,'app_states',NEW.id,'updated',json_object('kind',OLD.kind,'revision',OLD.revision,'updated_at',OLD.updated_at),json_object('kind',NEW.kind,'revision',NEW.revision,'updated_at',NEW.updated_at),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
--> statement-breakpoint
CREATE TRIGGER atlas_history_app_states_delete AFTER DELETE ON atlas_app_states BEGIN
 INSERT INTO atlas_history(owner,entity,record_id,action,before_json,after_json,created_at) VALUES (OLD.owner,'app_states',OLD.id,'removed',json_object('kind',OLD.kind,'revision',OLD.revision,'updated_at',OLD.updated_at),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
