CREATE TABLE `AcmeAccount` (
	`id` text PRIMARY KEY,
	`name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`acmeUrl` text DEFAULT '' NOT NULL,
	`creds` text,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updatedAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Certificate` (
	`id` text PRIMARY KEY,
	`key` text DEFAULT '' NOT NULL,
	`domain` text DEFAULT '' NOT NULL,
	`alt` text DEFAULT '[]' NOT NULL,
	`config` text,
	`ca` text DEFAULT '' NOT NULL,
	`cer` text DEFAULT '' NOT NULL,
	`csr` text DEFAULT '' NOT NULL,
	`acmeAccountId` text,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updatedAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Client` (
	`id` text PRIMARY KEY,
	`name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`token` text DEFAULT '' NOT NULL,
	`allow` text DEFAULT '[]' NOT NULL,
	`acmeAccountId` text,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updatedAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Certificate_acmeAccountId_idx` ON `Certificate` (`acmeAccountId`);--> statement-breakpoint
CREATE INDEX `Client_acmeAccountId_idx` ON `Client` (`acmeAccountId`);