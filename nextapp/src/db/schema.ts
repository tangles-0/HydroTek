import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { accounts, sessions, users, verificationTokens } from "./authSchemas";
export { accounts, sessions, users, verificationTokens };

export const records = pgTable("Record", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"), // Example for filtering
  userId: text("userId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updatedAt", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const devices = pgTable(
  "Device",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    accountId: text("accountId").notNull(),
    name: text("name").notNull().default("HydroTek Device"),
    token: text("token").notNull(),
    status: text("status").notNull().default("pending"),
    configVersion: integer("configVersion").notNull().default(1),
    localConfigVersion: integer("localConfigVersion").notNull().default(0),
    configSyncState: text("configSyncState").notNull().default("success"),
    desiredConfig: jsonb("desiredConfig").notNull().default(sql`'{}'::jsonb`),
    lastConfigReportedAt: timestamp("lastConfigReportedAt", { mode: "date" }),
    lastSeenAt: timestamp("lastSeenAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    removedAt: timestamp("removedAt", { mode: "date" }),
  },
  (t) => ({
    accountIdx: index("Device_account_idx").on(t.accountId),
    tokenIdx: index("Device_token_idx").on(t.token),
  })
);

export const devicePairings = pgTable(
  "DevicePairing",
  {
    code: text("code").primaryKey(),
    accountId: text("accountId"),
    deviceId: text("deviceId"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    confirmedAt: timestamp("confirmedAt", { mode: "date" }),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    deviceIdx: index("DevicePairing_device_idx").on(t.deviceId),
    accountIdx: index("DevicePairing_account_idx").on(t.accountId),
  })
);

export const telemetryEvents = pgTable(
  "TelemetryEvent",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    deviceId: text("deviceId").notNull(),
    accountId: text("accountId").notNull(),
    tempC: integer("tempC"),
    humidity: integer("humidity"),
    flowMl: integer("flowMl"),
    lampOn: boolean("lampOn"),
    pumpOn: boolean("pumpOn"),
    float1: boolean("float1"),
    float2: boolean("float2"),
    alarmActive: boolean("alarmActive"),
    alarmReason: text("alarmReason"),
    alarmTempHigh: boolean("alarmTempHigh"),
    alarmTempLow: boolean("alarmTempLow"),
    alarmFloat1: boolean("alarmFloat1"),
    alarmFloat2: boolean("alarmFloat2"),
    alarmPumpLowFlow: boolean("alarmPumpLowFlow"),
    alarmWifiDisconnected: boolean("alarmWifiDisconnected"),
    reportReason: text("reportReason"),
    intervalSeconds: integer("intervalSeconds"),
    pumpOnSeconds: integer("pumpOnSeconds"),
    avgFlowMlPerMin: real("avgFlowMlPerMin"),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    accountTimeIdx: index("TelemetryEvent_account_time_idx").on(t.accountId, t.createdAt),
    deviceTimeIdx: index("TelemetryEvent_device_time_idx").on(t.deviceId, t.createdAt),
  })
);

// Example relations
export const usersRelations = relations(users, ({ many }) => ({
  records: many(records),
  devices: many(devices),
}));

export const recordsRelations = relations(records, ({ one }) => ({
  user: one(users, { fields: [records.userId], references: [users.id] }),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(users, { fields: [devices.accountId], references: [users.id] }),
  telemetry: many(telemetryEvents),
}));

export const telemetryEventsRelations = relations(telemetryEvents, ({ one }) => ({
  device: one(devices, { fields: [telemetryEvents.deviceId], references: [devices.id] }),
}));
