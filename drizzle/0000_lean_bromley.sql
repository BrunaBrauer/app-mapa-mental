CREATE TABLE `maps` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`layout` text DEFAULT 'right' NOT NULL,
	`share_token` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `maps_share_token_unique` ON `maps` (`share_token`);--> statement-breakpoint
CREATE INDEX `maps_owner_updated_idx` ON `maps` (`owner_id`,`updated_at`);
