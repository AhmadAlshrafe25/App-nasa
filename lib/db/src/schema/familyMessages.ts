import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const earthFamilyMembers = pgTable("earth_family_members", {
  id: serial("id").primaryKey(),
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),
  astronautId: varchar("astronaut_id", { length: 80 }).notNull().default("AST-01"),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  relationship: varchar("relationship", { length: 80 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const earthFamilyInvites = pgTable("earth_family_invites", {
  id: serial("id").primaryKey(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  astronautId: varchar("astronaut_id", { length: 80 }).notNull().default("AST-01"),
  createdByUserId: varchar("created_by_user_id", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedByUserId: varchar("accepted_by_user_id", { length: 255 }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const earthFamilyUploads = pgTable("earth_family_uploads", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull().unique(),
  uploadedByUserId: varchar("uploaded_by_user_id", { length: 255 }).notNull(),
  contentType: varchar("content_type", { length: 120 }).notNull(),
  declaredSize: integer("declared_size").notNull(),
  consumed: boolean("consumed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const earthFamilyMessages = pgTable(
  "earth_family_messages",
  {
    id: serial("id").primaryKey(),
    astronautId: varchar("astronaut_id", { length: 80 }).notNull().default("AST-01"),
    senderUserId: varchar("sender_user_id", { length: 255 }).notNull(),
    senderName: varchar("sender_name", { length: 100 }).notNull(),
    relationship: varchar("relationship", { length: 80 }).notNull(),
    title: varchar("title", { length: 120 }).notNull(),
    note: varchar("note", { length: 600 }),
    mediaType: varchar("media_type", { length: 12 }).$type<"audio" | "video">().notNull(),
    contentType: varchar("content_type", { length: 120 }).notNull(),
    fileSize: integer("file_size").notNull(),
    objectPath: text("object_path").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
  },
  (table) => [
    index("earth_family_messages_astronaut_created_idx").on(
      table.astronautId,
      table.createdAt,
    ),
    index("earth_family_messages_sender_created_idx").on(
      table.senderUserId,
      table.createdAt,
    ),
  ],
);
