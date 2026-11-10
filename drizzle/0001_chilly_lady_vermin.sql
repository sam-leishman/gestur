PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_images` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`image_id` text,
	`file_path` text NOT NULL,
	`title` text NOT NULL,
	`result` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
-- Backfill filePath/title from the still-live `images` row. Left-joined
-- (rather than inner-joined) and with `image_id` explicitly nulled when no
-- match is found: foreign_keys enforcement was never turned on for this
-- connection before this migration, so any row whose image was already
-- deleted pre-migration is a dangling (non-null, non-matching) reference
-- rather than something already cleaned up by cascade — this preserves it
-- as a "removed from catalogue" entry instead of silently dropping it.
INSERT INTO `__new_session_images`("id", "session_id", "image_id", "file_path", "title", "result", "position")
SELECT si."id", si."session_id",
	CASE WHEN img."id" IS NULL THEN NULL ELSE si."image_id" END,
	COALESCE(img."file_path", si."image_id"),
	COALESCE(img."title", 'Unknown image'),
	si."result", si."position"
FROM `session_images` si LEFT JOIN `images` img ON img."id" = si."image_id";--> statement-breakpoint
DROP TABLE `session_images`;--> statement-breakpoint
ALTER TABLE `__new_session_images` RENAME TO `session_images`;--> statement-breakpoint
CREATE TABLE `__new_user_image_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`image_id` text,
	`file_path` text NOT NULL,
	`title` text NOT NULL,
	`draw_count` integer DEFAULT 0 NOT NULL,
	`skip_count` integer DEFAULT 0 NOT NULL,
	`liked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_user_image_stats`("id", "user_id", "image_id", "file_path", "title", "draw_count", "skip_count", "liked")
SELECT uis."id", uis."user_id",
	CASE WHEN img."id" IS NULL THEN NULL ELSE uis."image_id" END,
	COALESCE(img."file_path", uis."image_id"),
	COALESCE(img."title", 'Unknown image'),
	uis."draw_count", uis."skip_count", uis."liked"
FROM `user_image_stats` uis LEFT JOIN `images` img ON img."id" = uis."image_id";--> statement-breakpoint
DROP TABLE `user_image_stats`;--> statement-breakpoint
ALTER TABLE `__new_user_image_stats` RENAME TO `user_image_stats`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_image_stats_unique` ON `user_image_stats` (`user_id`,`image_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
