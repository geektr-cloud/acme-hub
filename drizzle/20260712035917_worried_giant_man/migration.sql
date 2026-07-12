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
CREATE TABLE `CertEvent` (
	`id` text PRIMARY KEY,
	`runId` text DEFAULT '' NOT NULL,
	`certHash` text NOT NULL,
	`event` text NOT NULL,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Certificate` (
	`id` text PRIMARY KEY,
	`privateKey` text DEFAULT '' NOT NULL,
	`commonName` text DEFAULT '' NOT NULL,
	`sans` text DEFAULT '[]' NOT NULL,
	`config` text,
	`chain` text DEFAULT '' NOT NULL,
	`certificate` text DEFAULT '' NOT NULL,
	`csr` text DEFAULT '' NOT NULL,
	`acmeAccountId` text,
	`certHash` text DEFAULT '' NOT NULL,
	`renewAt` text,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updatedAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ConsumerLog` (
	`id` text PRIMARY KEY,
	`consumerId` text DEFAULT '' NOT NULL,
	`event` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Consumer` (
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
CREATE TABLE `DnsCredential` (
	`id` text PRIMARY KEY,
	`name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`provider` text DEFAULT 'cloudflare' NOT NULL,
	`creds` text,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updatedAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Domain` (
	`id` text PRIMARY KEY,
	`name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`dnsCredentialId` text,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updatedAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
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
CREATE TABLE `Setting` (
	`key` text PRIMARY KEY,
	`value` text DEFAULT '' NOT NULL,
	`createdAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updatedAt` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `CertEvent_runId_idx` ON `CertEvent` (`runId`);--> statement-breakpoint
CREATE INDEX `CertEvent_certHash_idx` ON `CertEvent` (`certHash`);--> statement-breakpoint
CREATE INDEX `Certificate_acmeAccountId_idx` ON `Certificate` (`acmeAccountId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Certificate_certHash_uniq` ON `Certificate` (`certHash`) WHERE certHash != '';--> statement-breakpoint
CREATE INDEX `Certificate_renewAt_idx` ON `Certificate` (`renewAt`);--> statement-breakpoint
CREATE INDEX `ConsumerLog_consumerId_idx` ON `ConsumerLog` (`consumerId`);--> statement-breakpoint
CREATE INDEX `Consumer_acmeAccountId_idx` ON `Consumer` (`acmeAccountId`);--> statement-breakpoint
CREATE INDEX `Domain_dnsCredentialId_idx` ON `Domain` (`dnsCredentialId`);