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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("chat_session_userId_idx").on(table.userId)]
);

export const chatSessionRelations = relations(chatSession, ({ one }) => ({
  user: one(user, {
    fields: [chatSession.userId],
    references: [user.id],
  }),
}));
