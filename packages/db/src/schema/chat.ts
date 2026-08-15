import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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

export const chatSessionRelations = relations(chatSession, ({ one, many }) => ({
  user: one(user, {
    fields: [chatSession.userId],
    references: [user.id],
  }),
  messages: many(chatMessage),
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
}));
