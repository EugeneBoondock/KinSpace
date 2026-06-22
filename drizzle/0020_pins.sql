ALTER TABLE `post_comments` ADD COLUMN `pinned_at` integer;--> statement-breakpoint
ALTER TABLE `community_posts` ADD COLUMN `pinned_in_group_at` integer;--> statement-breakpoint
CREATE TABLE `user_pinned_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `community_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_pinned_posts_uniq` ON `user_pinned_posts` (`user_id`,`post_id`);
--> statement-breakpoint
CREATE INDEX `user_pinned_posts_user_idx` ON `user_pinned_posts` (`user_id`);
