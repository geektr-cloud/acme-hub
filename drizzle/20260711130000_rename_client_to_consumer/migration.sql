ALTER TABLE `Client` RENAME TO `Consumer`;--> statement-breakpoint
DROP INDEX IF EXISTS `Client_acmeAccountId_idx`;--> statement-breakpoint
CREATE INDEX `Consumer_acmeAccountId_idx` ON `Consumer` (`acmeAccountId`);
