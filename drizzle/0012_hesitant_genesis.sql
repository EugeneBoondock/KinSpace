ALTER TABLE `community_posts` ADD `group_id` text;--> statement-breakpoint
CREATE INDEX `posts_group_idx` ON `community_posts` (`group_id`);--> statement-breakpoint
ALTER TABLE `group_members` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `groups` ADD `cover_url` text;--> statement-breakpoint
ALTER TABLE `groups` ADD `icon_url` text;