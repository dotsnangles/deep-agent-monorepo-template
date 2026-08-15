import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../schema";
import { chatMessage, chatSession } from "../schema/chat";
import type {
  ChatRepository,
  ChatSessionEntity,
  CreateMessageParams,
  CreateSessionParams,
  DeleteSubtreeResult,
  MessageNode,
  SaveMessageResult,
  TreeResult,
} from "./chat-repository";
import {
  pruneSubtree,
  resolveActiveLeafAfterPrune,
  traverseActivePath,
  createSessionSnippet,
} from "./tree-utils";

export type DrizzleDb = NodePgDatabase<typeof schema>;

function toSessionEntity(record: typeof chatSession.$inferSelect): ChatSessionEntity {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    activeLeafId: record.activeLeafId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toMessageNode(record: typeof chatMessage.$inferSelect): MessageNode {
  return {
    id: record.id,
    sessionId: record.sessionId,
    parentId: record.parentId,
    role: record.role as "user" | "assistant" | "system",
    content: record.content,
    createdAt: record.createdAt,
  };
}

export class DrizzleChatRepository implements ChatRepository {
  constructor(private db: DrizzleDb) {}

  public async getSessions(userId: string): Promise<ChatSessionEntity[]> {
    const records = await this.db
      .select()
      .from(chatSession)
      .where(eq(chatSession.userId, userId))
      .orderBy(desc(chatSession.updatedAt));

    return records.map(toSessionEntity);
  }

  public async getSession(sessionId: string, userId: string): Promise<ChatSessionEntity | null> {
    const [record] = await this.db
      .select()
      .from(chatSession)
      .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)))
      .limit(1);

    return record ? toSessionEntity(record) : null;
  }

  public async createSession(params: CreateSessionParams): Promise<ChatSessionEntity> {
    const [created] = await this.db
      .insert(chatSession)
      .values({
        id: params.id,
        userId: params.userId,
        title: params.title || "새로운 대화",
        activeLeafId: params.activeLeafId || null,
      })
      .returning();

    return toSessionEntity(created);
  }

  public async updateSessionTitle(sessionId: string, userId: string, title: string): Promise<boolean> {
    const [updated] = await this.db
      .update(chatSession)
      .set({
        title,
        updatedAt: new Date(),
      })
      .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)))
      .returning();

    return !!updated;
  }

  public async updateSessionActiveLeaf(
    sessionId: string,
    userId: string,
    activeLeafId: string | null
  ): Promise<boolean> {
    const [updated] = await this.db
      .update(chatSession)
      .set({
        activeLeafId,
        updatedAt: new Date(),
      })
      .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)))
      .returning();

    return !!updated;
  }

  public async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(chatSession)
      .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)))
      .returning();

    return !!deleted;
  }

  public async getTree(sessionId: string, userId: string): Promise<TreeResult | null> {
    const [sessionRecord] = await this.db
      .select()
      .from(chatSession)
      .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)))
      .limit(1);

    if (!sessionRecord) {
      return null;
    }

    const messages = await this.db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.sessionId, sessionId))
      .orderBy(asc(chatMessage.createdAt));

    const nodes = messages.map(toMessageNode);
    const activePath = traverseActivePath(nodes, sessionRecord.activeLeafId);

    return {
      sessionId: sessionRecord.id,
      activeLeafId: sessionRecord.activeLeafId,
      messages: nodes,
      activePath,
    };
  }

  public async saveMessage(params: CreateMessageParams, userId: string): Promise<SaveMessageResult | null> {
    return await this.db.transaction(async (tx) => {
      const [existingSession] = await (tx as unknown as DrizzleDb)
        .select()
        .from(chatSession)
        .where(eq(chatSession.id, params.sessionId))
        .limit(1);

      if (existingSession && existingSession.userId !== userId) {
        return null;
      }

      const isNewSession = !existingSession;
      const messageId = params.id || crypto.randomUUID();
      const snippet = createSessionSnippet(params.content);

      // Atomic session upsert with tenant boundary guard
      const [sessionRecord] = await (tx as unknown as DrizzleDb)
        .insert(chatSession)
        .values({
          id: params.sessionId,
          userId,
          title: snippet,
          activeLeafId: messageId,
        })
        .onConflictDoUpdate({
          target: chatSession.id,
          set: {
            activeLeafId: messageId,
            updatedAt: new Date(),
          },
          where: eq(chatSession.userId, userId),
        })
        .returning();

      // Message insert
      const [messageRecord] = await (tx as unknown as DrizzleDb)
        .insert(chatMessage)
        .values({
          id: messageId,
          sessionId: params.sessionId,
          parentId: params.parentId || null,
          role: params.role,
          content: params.content,
        })
        .returning();

      return {
        message: toMessageNode(messageRecord),
        session: toSessionEntity(sessionRecord),
        isNewSession,
      };
    });
  }

  public async deleteSubtree(
    sessionId: string,
    messageId: string,
    userId: string
  ): Promise<DeleteSubtreeResult | null> {
    return await this.db.transaction(async (tx) => {
      const [sessionRecord] = await (tx as unknown as DrizzleDb)
        .select()
        .from(chatSession)
        .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)))
        .limit(1);

      if (!sessionRecord) {
        return null;
      }

      const allMessages = await (tx as unknown as DrizzleDb)
        .select()
        .from(chatMessage)
        .where(eq(chatMessage.sessionId, sessionId))
        .orderBy(asc(chatMessage.createdAt));

      const nodes = allMessages.map(toMessageNode);
      const targetNode = nodes.find((n) => n.id === messageId);
      if (!targetNode) {
        return null;
      }

      const { remainingNodes, deletedIds } = pruneSubtree(nodes, messageId);

      if (deletedIds.length > 0) {
        await (tx as unknown as DrizzleDb).delete(chatMessage).where(inArray(chatMessage.id, deletedIds));
      }

      const newActiveLeafId = resolveActiveLeafAfterPrune(
        remainingNodes,
        sessionRecord.activeLeafId,
        deletedIds,
        targetNode.parentId
      );

      await (tx as unknown as DrizzleDb)
        .update(chatSession)
        .set({
          activeLeafId: newActiveLeafId,
          updatedAt: new Date(),
        })
        .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)));

      return {
        deletedIds,
        activeLeafId: newActiveLeafId,
      };
    });
  }
}
