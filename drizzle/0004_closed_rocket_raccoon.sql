CREATE TABLE `medication_taken_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reminder_id` text,
	`medication` text DEFAULT '' NOT NULL,
	`day` text NOT NULL,
	`taken_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `med_taken_user_idx` ON `medication_taken_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `med_taken_day_idx` ON `medication_taken_log` (`day`);