ALTER TABLE `image_subjects` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `image_subjects`
SET `sort_order` = (
	SELECT COUNT(*)
	FROM `image_subjects` AS earlier
	WHERE earlier.`image_id` = `image_subjects`.`image_id`
		AND earlier.`subject_id` = `image_subjects`.`subject_id`
		AND earlier.`id` < `image_subjects`.`id`
);