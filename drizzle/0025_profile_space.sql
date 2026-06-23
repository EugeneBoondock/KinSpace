ALTER TABLE `profiles` ADD COLUMN `space_theme` text DEFAULT 'forest' NOT NULL;
--> statement-breakpoint
ALTER TABLE `profiles` ADD COLUMN `space_accent` text DEFAULT 'sage' NOT NULL;
--> statement-breakpoint
ALTER TABLE `profiles` ADD COLUMN `space_font` text DEFAULT 'clean' NOT NULL;
--> statement-breakpoint
ALTER TABLE `profiles` ADD COLUMN `space_motto` text;
--> statement-breakpoint
ALTER TABLE `profiles` ADD COLUMN `space_vibe` text;
--> statement-breakpoint
ALTER TABLE `profiles` ADD COLUMN `space_pinned_note` text;
