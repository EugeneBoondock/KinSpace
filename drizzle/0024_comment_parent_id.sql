ALTER TABLE `post_comments` ADD `parent_id` text REFERENCES post_comments(id);
CREATE INDEX `comments_parent_idx` ON `post_comments` (`parent_id`);
