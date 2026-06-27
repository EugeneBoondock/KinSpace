CREATE TABLE `guide_memories` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `persona` text DEFAULT 'mira' NOT NULL,
  `summary` text,
  `latest_session_summary` text,
  `latest_session_id` text,
  `latest_session_ended_at` integer,
  `key_themes` text DEFAULT '[]',
  `session_count` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guide_memories_user_persona_uniq` ON `guide_memories` (`user_id`, `persona`);
--> statement-breakpoint
CREATE INDEX `guide_memories_user_idx` ON `guide_memories` (`user_id`);
