CREATE TABLE `condition_research_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`condition_slug` text NOT NULL,
	`user_id` text NOT NULL,
	`question` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`votes_count` integer DEFAULT 0 NOT NULL,
	`answers_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `condition_research_questions_condition_idx` ON `condition_research_questions` (`condition_slug`);--> statement-breakpoint
CREATE INDEX `condition_research_questions_status_idx` ON `condition_research_questions` (`status`);--> statement-breakpoint
CREATE TABLE `condition_research_question_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `condition_research_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `condition_research_question_votes_uniq` ON `condition_research_question_votes` (`question_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `condition_research_question_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`user_id` text NOT NULL,
	`answer` text NOT NULL,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `condition_research_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `condition_research_question_answers_question_idx` ON `condition_research_question_answers` (`question_id`);
