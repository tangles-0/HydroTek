CREATE TABLE "Account" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "DevicePairing" (
	"code" text PRIMARY KEY NOT NULL,
	"accountId" text,
	"deviceId" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"confirmedAt" timestamp,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Device" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" text NOT NULL,
	"name" text DEFAULT 'HydroTek Device' NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"configVersion" integer DEFAULT 1 NOT NULL,
	"localConfigVersion" integer DEFAULT 0 NOT NULL,
	"configSyncState" text DEFAULT 'success' NOT NULL,
	"desiredConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lastConfigReportedAt" timestamp,
	"lastSeenAt" timestamp,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"removedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "Record" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"userId" text NOT NULL,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "TelemetryEvent" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deviceId" text NOT NULL,
	"accountId" text NOT NULL,
	"tempC" integer,
	"humidity" integer,
	"flowMl" integer,
	"lampOn" boolean,
	"pumpOn" boolean,
	"float1" boolean,
	"float2" boolean,
	"alarmActive" boolean,
	"alarmReason" text,
	"alarmTempHigh" boolean,
	"alarmTempLow" boolean,
	"alarmFloat1" boolean,
	"alarmFloat2" boolean,
	"alarmPumpLowFlow" boolean,
	"alarmWifiDisconnected" boolean,
	"reportReason" text,
	"intervalSeconds" integer,
	"pumpOnSeconds" integer,
	"avgFlowMlPerMin" real,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"passwordHash" text,
	"emailVerified" timestamp,
	"image" text,
	"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "VerificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account" USING btree ("provider","providerAccountId");--> statement-breakpoint
CREATE INDEX "DevicePairing_device_idx" ON "DevicePairing" USING btree ("deviceId");--> statement-breakpoint
CREATE INDEX "DevicePairing_account_idx" ON "DevicePairing" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "Device_account_idx" ON "Device" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "Device_token_idx" ON "Device" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session" USING btree ("sessionToken");--> statement-breakpoint
CREATE INDEX "TelemetryEvent_account_time_idx" ON "TelemetryEvent" USING btree ("accountId","createdAt");--> statement-breakpoint
CREATE INDEX "TelemetryEvent_device_time_idx" ON "TelemetryEvent" USING btree ("deviceId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken" USING btree ("identifier","token");