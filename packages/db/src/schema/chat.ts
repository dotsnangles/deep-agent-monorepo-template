import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { AttachmentEntity } from "@repo/validators";

import { user } from "./auth";

export const chatSession = pgTable(
  "chat_session",
  {
    id: text("id").primaryKey(), // LangGraph thread_id (UUID or unique string)
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("새로운 대화"),
    activeLeafId: text("active_leaf_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("chat_session_userId_idx").on(table.userId)]
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(), // UUID string
    sessionId: text("session_id")
      .notNull()
      .references(() => chatSession.id, { onDelete: "cascade" }),
    parentId: text("parent_id"), // Self-referencing FK, nullable for root message
    role: text("role").notNull(), // 'user' | 'assistant' | 'system'
    content: text("content").notNull(),
    attachments: jsonb("attachments")
      .$type<AttachmentEntity[]>()
      .default([])
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("chat_message_sessionId_idx").on(table.sessionId),
    index("chat_message_parentId_idx").on(table.parentId),
  ]
);

export const chatAttachment = pgTable(
  "chat_attachment",
  {
    id: text("id").primaryKey(), // UUID string
    sessionId: text("session_id")
      .notNull()
      .references(() => chatSession.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .references(() => chatMessage.id, { onDelete: "set null" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes"),
    uploadStatus: text("upload_status").notNull().default("ready"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_attachment_sessionId_idx").on(table.sessionId),
    index("chat_attachment_messageId_idx").on(table.messageId),
    index("chat_attachment_userId_idx").on(table.userId),
  ]
);

export const chatArtifact = pgTable(
  "chat_artifact",
  {
    id: text("id").primaryKey(), // UUID string
    sessionId: text("session_id")
      .notNull()
      .references(() => chatSession.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .references(() => chatMessage.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_artifact_sessionId_idx").on(table.sessionId),
    index("chat_artifact_messageId_idx").on(table.messageId),
  ]
);

export const chatSessionRelations = relations(chatSession, ({ one, many }) => ({
  user: one(user, {
    fields: [chatSession.userId],
    references: [user.id],
  }),
  messages: many(chatMessage),
  artifacts: many(chatArtifact),
  attachments: many(chatAttachment),
}));

export const chatMessageRelations = relations(chatMessage, ({ one, many }) => ({
  session: one(chatSession, {
    fields: [chatMessage.sessionId],
    references: [chatSession.id],
  }),
  parent: one(chatMessage, {
    fields: [chatMessage.parentId],
    references: [chatMessage.id],
    relationName: "message_tree",
  }),
  children: many(chatMessage, {
    relationName: "message_tree",
  }),
  artifacts: many(chatArtifact),
  attachments: many(chatAttachment),
}));

export const chatArtifactRelations = relations(chatArtifact, ({ one }) => ({
  session: one(chatSession, {
    fields: [chatArtifact.sessionId],
    references: [chatSession.id],
  }),
  message: one(chatMessage, {
    fields: [chatArtifact.messageId],
    references: [chatMessage.id],
  }),
}));

export const chatAttachmentRelations = relations(chatAttachment, ({ one }) => ({
  session: one(chatSession, {
    fields: [chatAttachment.sessionId],
    references: [chatSession.id],
  }),
  message: one(chatMessage, {
    fields: [chatAttachment.messageId],
    references: [chatMessage.id],
  }),
  user: one(user, {
    fields: [chatAttachment.userId],
    references: [user.id],
  }),
}));
