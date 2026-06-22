ALTER TABLE `condition_reports` ADD `is_search_visible` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `condition_reports` ADD `completion_state` text DEFAULT 'complete' NOT NULL;
