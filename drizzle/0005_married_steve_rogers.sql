CREATE TABLE `game_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_key` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_scores_user_idx` ON `game_scores` (`user_id`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `anonymous_profile_visibility` text DEFAULT 'connections' NOT NULL;