ALTER TABLE `journal_entries` ADD `event_kind` text DEFAULT 'journal' NOT NULL;
--> statement-breakpoint
ALTER TABLE `journal_entries` ADD `condition_slug` text;
--> statement-breakpoint
ALTER TABLE `journal_entries` ADD `symptom` text;
--> statement-breakpoint
ALTER TABLE `journal_entries` ADD `treatment` text;
--> statement-breakpoint
ALTER TABLE `journal_entries` ADD `medication` text;
--> statement-breakpoint
ALTER TABLE `journal_entries` ADD `intensity` integer;
--> statement-breakpoint
ALTER TABLE `symptom_logs` ADD `condition_slug` text;
--> statement-breakpoint
ALTER TABLE `treatment_logs` ADD `condition_slug` text;
--> statement-breakpoint
ALTER TABLE `medication_reminders` ADD `condition_slug` text;
