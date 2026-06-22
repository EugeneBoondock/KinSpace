CREATE TABLE `condition_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`condition_slug` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `condition_comments_idx` ON `condition_comments` (`condition_slug`);