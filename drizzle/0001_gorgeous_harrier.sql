CREATE TABLE `condition_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`condition_slug` text NOT NULL,
	`age_of_onset` integer,
	`symptoms` text DEFAULT '[]',
	`triggers` text DEFAULT '[]',
	`comorbidities` text DEFAULT '[]',
	`tests` text DEFAULT '[]',
	`treatments` text DEFAULT '[]',
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `condition_reports_uniq` ON `condition_reports` (`user_id`,`condition_slug`);--> statement-breakpoint
CREATE INDEX `condition_reports_condition_idx` ON `condition_reports` (`condition_slug`);--> statement-breakpoint
CREATE TABLE `condition_tests` (
	`id` text PRIMARY KEY NOT NULL,
	`condition_slug` text NOT NULL,
	`test_slug` text NOT NULL,
	`prevalence` real
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cond_test_uniq` ON `condition_tests` (`condition_slug`,`test_slug`);--> statement-breakpoint
CREATE TABLE `tests` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
