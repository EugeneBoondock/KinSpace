CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`full_name` text,
	`pseudonym` text,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`avatar_url` text,
	`cover_image_url` text,
	`bio` text,
	`pronouns` text,
	`age` integer,
	`location` text,
	`timezone` text,
	`conditions` text DEFAULT '[]',
	`comorbidities` text DEFAULT '[]',
	`medications` text DEFAULT '[]',
	`status` text,
	`interests` text DEFAULT '[]',
	`mental_health_goals` text DEFAULT '[]',
	`preferred_communication` text DEFAULT 'chat',
	`emergency_contact` text,
	`emergency_phone` text,
	`followers` integer DEFAULT 0 NOT NULL,
	`following` integer DEFAULT 0 NOT NULL,
	`posts_count` integer DEFAULT 0 NOT NULL,
	`daily_mood` text,
	`mood_updated_at` integer,
	`therapist_persona` text,
	`onboarding_complete` integer DEFAULT false NOT NULL,
	`onboarding_status` text,
	`visibility` text DEFAULT 'community' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_unique` ON `profiles` (`username`);--> statement-breakpoint
CREATE INDEX `profiles_username_idx` ON `profiles` (`username`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text,
	`ip` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`password_hash` text,
	`google_id` text,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`suspended_reason` text,
	`last_login_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);--> statement-breakpoint
CREATE INDEX `users_google_idx` ON `users` (`google_id`);--> statement-breakpoint
CREATE TABLE `activity_members` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `community_activities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_members_uniq` ON `activity_members` (`activity_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `angel_soul_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`angel_id` text NOT NULL,
	`soul_id` text NOT NULL,
	`relationship_status` text DEFAULT 'active' NOT NULL,
	`last_checkin` integer,
	`next_checkin` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`angel_id`) REFERENCES `angels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`soul_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `angel_soul_uniq` ON `angel_soul_relationships` (`angel_id`,`soul_id`);--> statement-breakpoint
CREATE TABLE `angels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`specialty` text,
	`experience_years` integer DEFAULT 0,
	`max_souls` integer DEFAULT 3 NOT NULL,
	`current_souls` integer DEFAULT 0 NOT NULL,
	`response_time` text,
	`rating` real DEFAULT 0 NOT NULL,
	`total_reviews` integer DEFAULT 0 NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`support_style` text,
	`bio` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender_id` text NOT NULL,
	`receiver_id` text,
	`room_id` text,
	`message` text NOT NULL,
	`message_type` text DEFAULT 'text' NOT NULL,
	`is_ai` integer DEFAULT false NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_room_idx` ON `chat_messages` (`room_id`);--> statement-breakpoint
CREATE INDEX `chat_sender_idx` ON `chat_messages` (`sender_id`);--> statement-breakpoint
CREATE TABLE `circle_members` (
	`id` text PRIMARY KEY NOT NULL,
	`circle_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`circle_id`) REFERENCES `support_circles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `circle_members_uniq` ON `circle_members` (`circle_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `community_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`activity_type` text,
	`location` text,
	`is_virtual` integer DEFAULT false NOT NULL,
	`max_participants` integer,
	`participants_count` integer DEFAULT 0 NOT NULL,
	`organizer_id` text NOT NULL,
	`scheduled_at` integer,
	`duration_minutes` integer,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`organizer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `community_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`type` text DEFAULT 'post' NOT NULL,
	`tags` text DEFAULT '[]',
	`media` text DEFAULT '[]',
	`likes_count` integer DEFAULT 0 NOT NULL,
	`reaction_counts` text DEFAULT '{}',
	`comments_count` integer DEFAULT 0 NOT NULL,
	`rekindle_count` integer DEFAULT 0 NOT NULL,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`edited` integer DEFAULT false NOT NULL,
	`rekindle_of` text,
	`rekindle_original` text,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `posts_user_idx` ON `community_posts` (`user_id`);--> statement-breakpoint
CREATE INDEX `posts_created_idx` ON `community_posts` (`created_at`);--> statement-breakpoint
CREATE TABLE `connection_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_id` text NOT NULL,
	`target_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `conn_requester_idx` ON `connection_requests` (`requester_id`);--> statement-breakpoint
CREATE INDEX `conn_target_idx` ON `connection_requests` (`target_user_id`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_members_uniq` ON `group_members` (`group_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`category` text NOT NULL,
	`type` text DEFAULT 'virtual' NOT NULL,
	`location` text,
	`latitude` real,
	`longitude` real,
	`tags` text DEFAULT '[]',
	`is_private` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`members_count` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `groups_category_idx` ON `groups` (`category`);--> statement-breakpoint
CREATE TABLE `mentors` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expertise` text DEFAULT '[]',
	`experience_years` integer DEFAULT 0,
	`sessions_completed` integer DEFAULT 0 NOT NULL,
	`rating` real DEFAULT 0 NOT NULL,
	`total_reviews` integer DEFAULT 0 NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`session_price` real DEFAULT 0,
	`bio` text,
	`credentials` text DEFAULT '[]',
	`is_verified` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`is_deleted` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_post_idx` ON `post_comments` (`post_id`);--> statement-breakpoint
CREATE TABLE `post_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_likes_uniq` ON `post_likes` (`post_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `post_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reaction` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_reactions_uniq` ON `post_reactions` (`post_id`,`user_id`,`reaction`);--> statement-breakpoint
CREATE TABLE `support_circles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`is_private` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ask_answer_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`answer_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`answer_id`) REFERENCES `ask_answers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ask_answer_votes_uniq` ON `ask_answer_votes` (`answer_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `ask_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`user_id` text,
	`content` text NOT NULL,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`is_ai` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `ask_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ask_a_question_idx` ON `ask_answers` (`question_id`);--> statement-breakpoint
CREATE TABLE `ask_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`question` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`scope` text DEFAULT 'public' NOT NULL,
	`group_id` text,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`related_conditions` text DEFAULT '[]',
	`tags` text DEFAULT '[]',
	`ai_answer` text,
	`ai_plain_summary` text,
	`ai_red_flags` text DEFAULT '[]',
	`ai_self_care` text DEFAULT '[]',
	`ai_see_professional` text DEFAULT '[]',
	`ai_sources` text DEFAULT '[]',
	`ai_reddit_threads` text DEFAULT '[]',
	`answers_count` integer DEFAULT 0 NOT NULL,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending-answer' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ask_q_scope_idx` ON `ask_questions` (`scope`);--> statement-breakpoint
CREATE INDEX `ask_q_user_idx` ON `ask_questions` (`user_id`);--> statement-breakpoint
CREATE TABLE `condition_symptoms` (
	`id` text PRIMARY KEY NOT NULL,
	`condition_slug` text NOT NULL,
	`symptom_slug` text NOT NULL,
	`prevalence` real
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cond_symptom_uniq` ON `condition_symptoms` (`condition_slug`,`symptom_slug`);--> statement-breakpoint
CREATE TABLE `condition_treatments` (
	`id` text PRIMARY KEY NOT NULL,
	`condition_slug` text NOT NULL,
	`treatment_slug` text NOT NULL,
	`effectiveness_avg` real DEFAULT 0 NOT NULL,
	`effectiveness_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cond_treat_uniq` ON `condition_treatments` (`condition_slug`,`treatment_slug`);--> statement-breakpoint
CREATE TABLE `condition_triggers` (
	`id` text PRIMARY KEY NOT NULL,
	`condition_slug` text NOT NULL,
	`trigger_slug` text NOT NULL,
	`prevalence` real
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cond_trigger_uniq` ON `condition_triggers` (`condition_slug`,`trigger_slug`);--> statement-breakpoint
CREATE TABLE `conditions` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`aliases` text DEFAULT '[]',
	`description` text,
	`category` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `experience_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`experience_id` text NOT NULL,
	`user_id` text NOT NULL,
	`value` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`experience_id`) REFERENCES `experiences`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `experience_votes_uniq` ON `experience_votes` (`experience_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `experiences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`condition_slug` text NOT NULL,
	`treatment_slug` text,
	`rating` integer,
	`content` text DEFAULT '' NOT NULL,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `experiences_condition_idx` ON `experiences` (`condition_slug`);--> statement-breakpoint
CREATE TABLE `symptoms` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `treatments` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text,
	`description` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `triggers` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_players` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`user_id` text NOT NULL,
	`player_order` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_players_uniq` ON `game_players` (`game_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`host_id` text NOT NULL,
	`game_type` text NOT NULL,
	`max_players` integer DEFAULT 2 NOT NULL,
	`current_players` integer DEFAULT 1 NOT NULL,
	`is_private` integer DEFAULT false NOT NULL,
	`room_code` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	`game_state` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `research_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`request` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`article_slug` text,
	`fulfilled_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `research_req_status_idx` ON `research_requests` (`status`);--> statement-breakpoint
CREATE TABLE `resource_contribution_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`contribution_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`contribution_id`) REFERENCES `resource_contributions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_contrib_votes_uniq` ON `resource_contribution_votes` (`contribution_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `resource_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`url` text,
	`upvotes` integer DEFAULT 0 NOT NULL,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `resource_contrib_resource_idx` ON `resource_contributions` (`resource_id`);--> statement-breakpoint
CREATE TABLE `resources` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`body_markdown` text,
	`key_findings` text DEFAULT '[]',
	`tags` text DEFAULT '[]',
	`topic` text,
	`plain_language_summary` text,
	`caveats` text DEFAULT '[]',
	`sources` text DEFAULT '[]',
	`url` text,
	`source` text,
	`category` text DEFAULT 'resource' NOT NULL,
	`type` text DEFAULT 'article' NOT NULL,
	`ai_generated` integer DEFAULT false NOT NULL,
	`research_mode` text,
	`model` text,
	`status` text DEFAULT 'published' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`submitted_by` text,
	`requested_by` text,
	`contributions_count` integer DEFAULT 0 NOT NULL,
	`pub_date` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`published_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `resources_category_idx` ON `resources` (`category`);--> statement-breakpoint
CREATE INDEX `resources_status_idx` ON `resources` (`status`);--> statement-breakpoint
CREATE TABLE `saved_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_resources_uniq` ON `saved_resources` (`user_id`,`resource_id`);--> statement-breakpoint
CREATE TABLE `support_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'group' NOT NULL,
	`address` text,
	`latitude` real,
	`longitude` real,
	`phone` text,
	`website` text,
	`rating` real DEFAULT 0,
	`description` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`mood` text,
	`tags` text DEFAULT '[]',
	`is_private` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `journal_user_idx` ON `journal_entries` (`user_id`);--> statement-breakpoint
CREATE TABLE `medication_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`medication` text NOT NULL,
	`dose` text,
	`times` text DEFAULT '[]',
	`active` integer DEFAULT true NOT NULL,
	`last_taken_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `med_reminders_user_idx` ON `medication_reminders` (`user_id`);--> statement-breakpoint
CREATE TABLE `mood_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mood` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`day` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mood_user_day_uniq` ON `mood_checkins` (`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `symptom_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`symptom` text NOT NULL,
	`severity` integer,
	`note` text,
	`logged_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `symptom_logs_user_idx` ON `symptom_logs` (`user_id`);--> statement-breakpoint
CREATE TABLE `therapy_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`persona` text,
	`theme` text,
	`mood_at_start` text,
	`mood_at_end` text,
	`message_count` integer DEFAULT 0 NOT NULL,
	`summary` text,
	`key_themes` text DEFAULT '[]',
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ended_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `therapy_user_idx` ON `therapy_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `treatment_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`treatment` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`effectiveness` integer,
	`side_effects` text DEFAULT '[]',
	`started_at` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `treatment_logs_user_idx` ON `treatment_logs` (`user_id`);--> statement-breakpoint
CREATE TABLE `ai_cost_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`feature` text NOT NULL,
	`model` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ai_cost_user_idx` ON `ai_cost_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_cost_created_idx` ON `ai_cost_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`meta` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_actor_idx` ON `audit_logs` (`actor_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `muted_topics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `muted_topics_uniq` ON `muted_topics` (`user_id`,`topic`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`data` text,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_by` text NOT NULL,
	`claimed_by` text,
	`reward_type` text DEFAULT 'plus_month' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`claimed_at` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`claimed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referrals_code_unique` ON `referrals` (`code`);--> statement-breakpoint
CREATE INDEX `referrals_code_idx` ON `referrals` (`code`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`target_owner_id` text,
	`reason` text NOT NULL,
	`detail` text,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_by` text,
	`resolution_note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reports_status_idx` ON `reports` (`status`);--> statement-breakpoint
CREATE INDEX `reports_target_idx` ON `reports` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`status` text DEFAULT 'none' NOT NULL,
	`paystack_customer_code` text,
	`paystack_subscription_code` text,
	`paystack_email_token` text,
	`plan_code` text,
	`current_period_end` integer,
	`trial_ends_at` integer,
	`cancel_at_period_end` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `usage_counters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`period` text NOT NULL,
	`feature` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_counters_uniq` ON `usage_counters` (`user_id`,`period`,`feature`);--> statement-breakpoint
CREATE TABLE `user_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`blocker_id` text NOT NULL,
	`blocked_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`blocker_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_blocks_uniq` ON `user_blocks` (`blocker_id`,`blocked_id`);