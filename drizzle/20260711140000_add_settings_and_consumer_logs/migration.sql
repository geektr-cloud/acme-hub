CREATE TABLE `Setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL DEFAULT '',
	`createdAt` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	`updatedAt` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE TABLE `ConsumerLog` (
	`id` text PRIMARY KEY NOT NULL,
	`consumerId` text NOT NULL DEFAULT '',
	`event` text NOT NULL DEFAULT '',
	`description` text NOT NULL DEFAULT '',
	`createdAt` text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE INDEX `ConsumerLog_consumerId_idx` ON `ConsumerLog` (`consumerId`);
