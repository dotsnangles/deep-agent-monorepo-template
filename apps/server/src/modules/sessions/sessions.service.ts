import crypto from "node:crypto";
import { chatRepository } from "@repo/db";

export async function getUserSessions(userId: string) {
  return chatRepository.getSessions(userId);
}

export async function getSessionById(sessionId: string, userId: string) {
  return chatRepository.getSession(sessionId, userId);
}

export async function createSession(userId: string, title = "새로운 대화", sessionId?: string) {
  return chatRepository.createSession({
    id: sessionId || crypto.randomUUID(),
    userId,
    title,
  });
}
