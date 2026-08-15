import crypto from "node:crypto";
import { chatSession, db } from "@repo/db";
import { and, desc, eq } from "drizzle-orm";

export async function getUserSessions(userId: string) {
  return db
    .select()
    .from(chatSession)
    .where(eq(chatSession.userId, userId))
    .orderBy(desc(chatSession.updatedAt));
}

export async function getSessionById(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(chatSession)
    .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)));
  return session || null;
}

export async function createSession(userId: string, title = "새로운 대화", sessionId?: string) {
  const [session] = await db
    .insert(chatSession)
    .values({
      id: sessionId || crypto.randomUUID(),
      userId,
      title,
    })
    .returning();
  return session;
}
