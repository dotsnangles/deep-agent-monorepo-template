import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
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
    attachments: record.attachments ?? [],
    createdAt: record.createdAt,
  };
}

export class DrizzleChatRepository implements ChatRepository {
  constructor(private db: DrizzleDb) {}

  private async updateSessionRecord(
    filter: SQL,
    patch: Partial<typeof chatSession.$inferInsert>
  ): Promise<boolean> {
    const [updated] = await this.db
      .update(chatSession)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(filter)
      .returning();

    return !!updated;
  }

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

    if (!created) {
      throw new Error("Failed to create chat session record");
    }

    return toSessionEntity(created);
  }

  public async updateSessionTitle(sessionId: string, userId: string, title: string): Promise<boolean> {
    return this.updateSessionRecord(
      and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)) as SQL,
      { title }
    );
  }

  public async updateSessionTitleById(sessionId: string, title: string): Promise<boolean> {
    return this.updateSessionRecord(eq(chatSession.id, sessionId), { title });
  }

  public async updateSessionActiveLeaf(
    sessionId: string,
    userId: string,
    activeLeafId: string | null
  ): Promise<boolean> {
    return this.updateSessionRecord(
      and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)) as SQL,
      { activeLeafId }
    );
  }

  public async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(chatSession)
      .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)))
      .returning();

    return !!deleted;
  }

  public async getTree(sessionId: string, userId: string): Promise<TreeResult | null> {
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      return null;
    }

    const records = await this.db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.sessionId, sessionId))
      .orderBy(asc(chatMessage.createdAt));

    const messages = records.map(toMessageNode);
    const activePath = traverseActivePath(messages, session.activeLeafId);

    return {
      sessionId,
      activeLeafId: session.activeLeafId,
      messages,
      activePath,
    };
  }

  public async saveMessage(
    params: CreateMessageParams,
    userId: string
  ): Promise<SaveMessageResult | null> {
    return await this.db.transaction(async (tx) => {
      // 1. Check existing session for tenant boundary verification
      const [existingSession] = await tx
        .select()
        .from(chatSession)
        .where(eq(chatSession.id, params.sessionId))
        .limit(1);

      if (existingSession && existingSession.userId !== userId) {
        return null;
      }

      const isNewSession = !existingSession;
      const messageId = params.id || crypto.randomUUID();
      const initialTitle = createSessionSnippet(params.content);

      // 2. Upsert session with activeLeafId
      const [sessionRecord] = await tx
        .insert(chatSession)
        .values({
          id: params.sessionId,
          userId,
          title: initialTitle,
          activeLeafId: messageId,
        })
        .onConflictDoUpdate({
          target: chatSession.id,
          set: {
            activeLeafId: messageId,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!sessionRecord) {
        return null;
      }

      // 3. Insert message node
      const [insertedMessage] = await tx
        .insert(chatMessage)
        .values({
          id: messageId,
          sessionId: params.sessionId,
          parentId: params.parentId || null,
          role: params.role,
          content: params.content,
          attachments: params.attachments ?? [],
        })
        .returning();

      if (!insertedMessage) {
        return null;
      }

      return {
        message: toMessageNode(insertedMessage),
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
      // 1. Verify session ownership
      const [sessionRecord] = await tx
        .select()
        .from(chatSession)
        .where(and(eq(chatSession.id, sessionId), eq(chatSession.userId, userId)))
        .limit(1);

      if (!sessionRecord) {
        return null;
      }

      // 2. Fetch all messages in the session
      const allRecords = await tx
        .select()
        .from(chatMessage)
        .where(eq(chatMessage.sessionId, sessionId))
        .orderBy(asc(chatMessage.createdAt));

      const allNodes = allRecords.map(toMessageNode);
      const targetNode = allNodes.find((n) => n.id === messageId);
      if (!targetNode) {
        return null;
      }

      // 3. Calculate recursive prune
      const { remainingNodes, deletedIds } = pruneSubtree(allNodes, messageId);

      // 4. Delete nodes from DB
      if (deletedIds.length > 0) {
        await tx.delete(chatMessage).where(inArray(chatMessage.id, deletedIds));
      }

      // 5. Compute new active leaf
      const newActiveLeafId = resolveActiveLeafAfterPrune(
        remainingNodes,
        sessionRecord.activeLeafId,
        deletedIds,
        targetNode.parentId
      );

      // 6. Update session active leaf pointer
      await tx
        .update(chatSession)
        .set({
          activeLeafId: newActiveLeafId,
          updatedAt: new Date(),
        })
        .where(eq(chatSession.id, sessionId));

      return {
        deletedIds,
        activeLeafId: newActiveLeafId,
      };
    });
  }
}

export const drizzleChatRepository = new DrizzleChatRepository(
  schema as any
);
