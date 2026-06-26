CREATE TABLE `ai_credit_balances` (
  `user_id` text PRIMARY KEY NOT NULL,
  `feature` text DEFAULT 'ai_therapy' NOT NULL,
  `credits` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_credit_purchases` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `feature` text DEFAULT 'ai_therapy' NOT NULL,
  `credits` integer NOT NULL,
  `amount_cents` integer NOT NULL,
  `provider` text DEFAULT 'payfast' NOT NULL,
  `provider_reference` text NOT NULL,
  `status` text DEFAULT 'complete' NOT NULL,
  `created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_credit_provider_ref_idx` ON `ai_credit_purchases` (`provider`, `provider_reference`);
--> statement-breakpoint
CREATE INDEX `ai_credit_user_idx` ON `ai_credit_purchases` (`user_id`);
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD COLUMN `payment_provider` text;
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD COLUMN `provider_customer_id` text;
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD COLUMN `provider_subscription_id` text;
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD COLUMN `provider_subscription_status` text;
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD COLUMN `provider_reference` text;
