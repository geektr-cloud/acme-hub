DROP INDEX IF EXISTS `Certificate_certHash_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `Certificate_certHash_uniq` ON `Certificate` (`certHash`) WHERE certHash != '';