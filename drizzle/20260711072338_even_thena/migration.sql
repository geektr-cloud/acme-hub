ALTER TABLE `CertEvent` ADD `runId` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `CertEvent_runId_idx` ON `CertEvent` (`runId`);