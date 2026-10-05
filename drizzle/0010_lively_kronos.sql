CREATE TABLE `atlas_apple_calendar` (
	`owner` text PRIMARY KEY NOT NULL,
	`credentials` text NOT NULL,
	`calendars_json` text NOT NULL,
	`selected_json` text NOT NULL,
	`updated_at` text NOT NULL
);
