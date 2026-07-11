CREATE TABLE `CertEvent` (
	`id` text PRIMARY KEY,
	`certHash` text NOT NULL,
	`event` text NOT NULL,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ResourceLock` (
	`id` text PRIMARY KEY,
	`owner` text NOT NULL,
	`remark` text DEFAULT '' NOT NULL,
	`expiresAt` text NOT NULL,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `Certificate` ADD `certHash` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `CertEvent_certHash_idx` ON `CertEvent` (`certHash`);--> statement-breakpoint
CREATE INDEX `Certificate_certHash_idx` ON `Certificate` (`certHash`);