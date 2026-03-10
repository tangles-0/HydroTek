import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Users (NextAuth)
export const users = pgTable(
  "User",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name"),
    email: text("email").notNull(),
    passwordHash: text("passwordHash"),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),
    createdAt: timestamp("createdAt", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => ({
    usersEmailIdx: uniqueIndex("User_email_key").on(t.email),
  })
);

export const accounts = pgTable(
  "Account",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("userId").notNull(),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    accountsProviderIdx: uniqueIndex(
      "Account_provider_providerAccountId_key"
    ).on(t.provider, t.providerAccountId),
  })
);

export const sessions = pgTable(
  "Session",
  {
    // Use sessionToken as primary key to match adapter expectations
    sessionToken: text("sessionToken").primaryKey(),
    userId: text("userId").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({
    sessionsTokenIdx: uniqueIndex("Session_sessionToken_key").on(
      t.sessionToken
    ),
  })
);

export const verificationTokens = pgTable(
  "VerificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({
    verificationTokensTokenIdx: uniqueIndex("VerificationToken_token_key").on(
      t.token
    ),
    verificationTokensIdentifierTokenIdx: uniqueIndex(
      "VerificationToken_identifier_token_key"
    ).on(t.identifier, t.token),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
