ALTER TABLE `chat_messages` ADD `session_id` text;--> statement-breakpoint
CREATE INDEX `chat_session_idx` ON `chat_messages` (`session_id`);