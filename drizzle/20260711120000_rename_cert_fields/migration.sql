DROP INDEX IF EXISTS `Certificate_certHash_uniq`;--> statement-breakpoint
DROP INDEX IF EXISTS `Certificate_acmeAccountId_idx`;--> statement-breakpoint
ALTER TABLE `Certificate` RENAME TO `Certificate_old`;--> statement-breakpoint
CREATE TABLE `Certificate` (
	`id` text PRIMARY KEY NOT NULL,
	`privateKey` text NOT NULL DEFAULT '',
	`commonName` text NOT NULL DEFAULT '',
	`sans` text NOT NULL DEFAULT '[]',
	`config` text,
	`chain` text NOT NULL DEFAULT '',
	`certificate` text NOT NULL DEFAULT '',
	`csr` text NOT NULL DEFAULT '',
	`acmeAccountId` text,
	`certHash` text NOT NULL DEFAULT '',
	`createdAt` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updatedAt` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);--> statement-breakpoint
INSERT INTO `Certificate` (`id`, `privateKey`, `commonName`, `sans`, `config`, `chain`, `certificate`, `csr`, `acmeAccountId`, `certHash`, `createdAt`, `updatedAt`)
SELECT `id`, `key`, `domain`, `alt`, `config`, `ca`, `cer`, `csr`, `acmeAccountId`, `certHash`, `createdAt`, `updatedAt` FROM `Certificate_old`;--> statement-breakpoint
DROP TABLE `Certificate_old`;--> statement-breakpoint
CREATE INDEX `Certificate_acmeAccountId_idx` ON `Certificate` (`acmeAccountId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Certificate_certHash_uniq` ON `Certificate` (`certHash`) WHERE certHash != '';
