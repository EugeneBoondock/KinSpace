CREATE TABLE `support_presence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topics` text DEFAULT '[]',
	`note` text,
	`available_until` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `support_presence_user_uniq` ON `support_presence` (`user_id`);
--> statement-breakpoint
CREATE TABLE `support_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`seeker_id` text NOT NULL,
	`note` text,
	`condition_slug` text,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`matched_user_id` text,
	`room_id` text,
	`matched_at` integer,
	`closed_at` integer,
	`closed_by` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`seeker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_requests_status_idx` ON `support_requests` (`status`);
--> statement-breakpoint
CREATE INDEX `support_requests_seeker_idx` ON `support_requests` (`seeker_id`);
