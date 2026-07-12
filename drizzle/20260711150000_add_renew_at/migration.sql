ALTER TABLE `Certificate` ADD `renewAt` text;--> statement-breakpoint
CREATE INDEX `Certificate_renewAt_idx` ON `Certificate` (`renewAt`);
