import { and, asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AttachmentEntity } from "@repo/validators";
import * as schema from "../schema";
import { chatArtifact, chatAttachment, chatMessage, chatSession } from "../schema/chat";
import type {
  ChatArtifactEntity,
  ChatAttachmentEntity,
  ChatRepository,
  ChatSessionEntity,
  CreateArtifactParams,
  CreateAttachmentParams,
  CreateMessageParams,
  CreateSessionParams,
  DeleteSubtreeResult,
  ForkSessionResult,
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

function toArtifactEntity(record: typeof chatArtifact.$inferSelect): ChatArtifactEntity {
  return {
    id: record.id,
    sessionId: record.sessionId,
    messageId: record.messageId,
    name: record.name,
    storageKey: record.storageKey,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    metadata: (record.metadata as Record<string, unknown>) ?? {},
    createdAt: record.createdAt,
  };
}

function toAttachmentEntity(record: typeof chatAttachment.$inferSelect): ChatAttachmentEntity {
  return {
    id: record.id,
    sessionId: record.sessionId,
    messageId: record.messageId,
    userId: record.userId,
    name: record.name,
    storageKey: record.storageKey,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    uploadStatus: record.uploadStatus,
    metadata: (record.metadata as Record<string, unknown>) ?? {},
    createdAt: record.createdAt,
  };
}

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

function toMessageNode(
  record: typeof chatMessage.$inferSelect,
  attachments?: AttachmentEntity[]
): MessageNode {
  return {
    id: record.id,
    sessionId: record.sessionId,
    parentId: record.parentId,
    role: record.role as "user" | "assistant" | "system",
    content: record.content,
    attachments: attachments ?? [],
    createdAt: record.createdAt,
  };
}

async function getAttachmentsMapForSession(
  db: DrizzleDb,
  sessionId: string
): Promise<Map<string, AttachmentEntity[]>> {
  const records = await db
    .select()
    .from(chatAttachment)
    .where(eq(chatAttachment.sessionId, sessionId))
    .orderBy(asc(chatAttachment.createdAt));

  const map = new Map<string, AttachmentEntity[]>();
  for (const r of records) {
    if (r.messageId) {
      const list = map.get(r.messageId) || [];
      list.push({
        id: r.id,
        name: r.name,
        mimeType: r.mimeType,
        size: r.sizeBytes ?? 0,
        s3Key: r.storageKey,
        url: `/api/storage/presigned-url?key=${encodeURIComponent(r.storageKey)}`,
      });
      map.set(r.messageId, list);
    }
  }
  return map;
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
    const [record] = await this.db
      .insert(chatSession)
      .values({
        id: params.id,
        userId: params.userId,
        title: params.title || "새로운 대화",
        activeLeafId: params.activeLeafId || null,
      })
      .returning();

    if (!record) {
      throw new Error("Failed to create chat session record");
    }

    return toSessionEntity(record);
  }

  public async updateSessionTitle(
    sessionId: string,
    userId: string,
    title: string
  ): Promise<boolean> {
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

    const [records, attachmentsMap] = await Promise.all([
      this.db
        .select()
        .from(chatMessage)
        .where(eq(chatMessage.sessionId, sessionId))
        .orderBy(asc(chatMessage.createdAt)),
      getAttachmentsMapForSession(this.db, sessionId),
    ]);

    const messages = records.map((r) => toMessageNode(r, attachmentsMap.get(r.id)));
    const activePath = traverseActivePath(messages, session.activeLeafId);

    return {
      sessionId,
      activeLeafId: session.activeLeafId,
      messages,
      activePath,
    };
  }

  public async getMessages(sessionId: string, userId: string): Promise<MessageNode[] | null> {
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      return null;
    }

    const [records, attachmentsMap] = await Promise.all([
      this.db
        .select()
        .from(chatMessage)
        .where(eq(chatMessage.sessionId, sessionId))
        .orderBy(asc(chatMessage.createdAt)),
      getAttachmentsMapForSession(this.db, sessionId),
    ]);

    return records.map((r) => toMessageNode(r, attachmentsMap.get(r.id)));
  }

  public async forkSession(
    sourceSessionId: string,
    fromMessageId: string,
    userId: string,
    newTitle?: string
  ): Promise<ForkSessionResult | null> {
    return await this.db.transaction(async (tx) => {
      const [sourceSession] = await tx
        .select()
        .from(chatSession)
        .where(and(eq(chatSession.id, sourceSessionId), eq(chatSession.userId, userId)))
        .limit(1);

      if (!sourceSession) {
        return null;
      }

      const records = await tx
        .select()
        .from(chatMessage)
        .where(eq(chatMessage.sessionId, sourceSessionId))
        .orderBy(asc(chatMessage.createdAt));

      const msgMap = new Map(records.map((r) => [r.id, r]));
      const targetMsg = msgMap.get(fromMessageId);
      if (!targetMsg) {
        return null;
      }

      const lineage: typeof records = [];
      const visited = new Set<string>();
      let curr: typeof targetMsg | undefined = targetMsg;

      while (curr && !visited.has(curr.id)) {
        visited.add(curr.id);
        lineage.push(curr);
        curr = curr.parentId ? msgMap.get(curr.parentId) : undefined;
      }
      lineage.reverse();

      const newSessionId = crypto.randomUUID();
      const title = newTitle || `${sourceSession.title} (분기)`;

      const idMap = new Map<string, string>();
      lineage.forEach((m) => {
        idMap.set(m.id, crypto.randomUUID());
      });

      const lastClonedId = idMap.get(fromMessageId) || null;

      const [newSession] = await tx
        .insert(chatSession)
        .values({
          id: newSessionId,
          userId,
          title,
          activeLeafId: lastClonedId,
        })
        .returning();

      if (!newSession) {
        throw new Error("Failed to create forked session record");
      }

      const clonedToInsert = lineage.map((r, idx) => {
        const clonedId = idMap.get(r.id)!;
        return {
          id: clonedId,
          sessionId: newSessionId,
          parentId: r.parentId ? idMap.get(r.parentId) ?? null : null,
          role: r.role,
          content: r.content,
          createdAt: new Date(r.createdAt.getTime() + idx),
        };
      });

      let insertedMessages: (typeof chatMessage.$inferSelect)[] = [];
      if (clonedToInsert.length > 0) {
        insertedMessages = await tx
          .insert(chatMessage)
          .values(clonedToInsert)
          .returning();
      }

      const sourceArtifacts = await tx
        .select()
        .from(chatArtifact)
        .where(eq(chatArtifact.sessionId, sourceSessionId));

      const artifactsToInsert = sourceArtifacts
        .filter((art) => art.messageId && idMap.has(art.messageId))
        .map((art) => ({
          id: crypto.randomUUID(),
          sessionId: newSessionId,
          messageId: idMap.get(art.messageId!)!,
          name: art.name,
          storageKey: art.storageKey,
          mimeType: art.mimeType,
          sizeBytes: art.sizeBytes,
          metadata: art.metadata ?? {},
        }));

      if (artifactsToInsert.length > 0) {
        await tx.insert(chatArtifact).values(artifactsToInsert);
      }

      const sourceAttachments = await tx
        .select()
        .from(chatAttachment)
        .where(eq(chatAttachment.sessionId, sourceSessionId));

      const attachmentsToInsert = sourceAttachments
        .filter((att) => att.messageId && idMap.has(att.messageId))
        .map((att) => ({
          id: crypto.randomUUID(),
          sessionId: newSessionId,
          messageId: idMap.get(att.messageId!)!,
          userId: att.userId,
          name: att.name,
          storageKey: att.storageKey,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          uploadStatus: att.uploadStatus,
          metadata: att.metadata ?? {},
        }));

      if (attachmentsToInsert.length > 0) {
        await tx.insert(chatAttachment).values(attachmentsToInsert);
      }

      const attachmentsByNewMessageId = new Map<string, AttachmentEntity[]>();
      for (const att of attachmentsToInsert) {
        const list = attachmentsByNewMessageId.get(att.messageId) || [];
        list.push({
          id: att.id,
          name: att.name,
          mimeType: att.mimeType,
          size: att.sizeBytes ?? 0,
          s3Key: att.storageKey,
          url: `/api/storage/presigned-url?key=${encodeURIComponent(att.storageKey)}`,
        });
        attachmentsByNewMessageId.set(att.messageId, list);
      }

      return {
        session: {
          ...toSessionEntity(newSession),
          activeLeafId: lastClonedId,
        },
        messages: insertedMessages.map((m) =>
          toMessageNode(m, attachmentsByNewMessageId.get(m.id))
        ),
      };
    });
  }

  public async saveMessage(
    params: CreateMessageParams,
    userId: string
  ): Promise<SaveMessageResult | null> {
    return await this.db.transaction(async (tx) => {
      const [existingSession] = await tx
        .select()
        .from(chatSession)
        .where(eq(chatSession.id, params.sessionId))
        .limit(1);

      if (existingSession && existingSession.userId !== userId) {
        return null;
      }

      let isNewSession = false;
      let sessionRecord = existingSession;

      // 2. Auto-create session on first user turn if it does not exist
      if (!sessionRecord) {
        isNewSession = true;
        const snippet = createSessionSnippet(params.content || "새로운 대화");
        const [createdSession] = await tx
          .insert(chatSession)
          .values({
            id: params.sessionId,
            userId,
            title: snippet,
            activeLeafId: null,
          })
          .returning();

        if (!createdSession) {
          throw new Error("Failed to auto-create session record");
        }
        sessionRecord = createdSession;
      }

      const messageId = params.id || crypto.randomUUID();

      const [insertedMessage] = await tx
        .insert(chatMessage)
        .values({
          id: messageId,
          sessionId: params.sessionId,
          parentId: params.parentId || null,
          role: params.role,
          content: params.content,
        })
        .returning();

      if (!insertedMessage) {
        return null;
      }

      if (params.attachments && params.attachments.length > 0) {
        for (const att of params.attachments) {
          const s3Key =
            att.s3Key ||
            att.url?.split("?")[0] ||
            `attachments/${userId}/${params.sessionId}/${att.id}_${att.name}`;
          await tx
            .insert(chatAttachment)
            .values({
              id: att.id,
              sessionId: params.sessionId,
              messageId,
              userId,
              name: att.name,
              storageKey: s3Key,
              mimeType: att.mimeType,
              sizeBytes: att.size ?? 0,
              uploadStatus: ((att as any).uploadStatus as any) || "ready",
              metadata: ((att as any).metadata as any) || {},
            })
            .onConflictDoUpdate({
              target: chatAttachment.id,
              set: {
                messageId,
              },
            });
        }
      }

      return {
        message: toMessageNode(insertedMessage, params.attachments),
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

      const allNodes = allRecords.map((r) => toMessageNode(r));
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

  public async saveArtifact(params: CreateArtifactParams): Promise<ChatArtifactEntity> {
    const id = params.id || `art_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const [record] = await this.db
      .insert(chatArtifact)
      .values({
        id,
        sessionId: params.sessionId,
        messageId: params.messageId || null,
        name: params.name,
        storageKey: params.storageKey,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes ?? null,
        metadata: params.metadata ?? {},
      })
      .returning();

    return toArtifactEntity(record);
  }

  public async getArtifactsBySession(sessionId: string): Promise<ChatArtifactEntity[]> {
    const records = await this.db
      .select()
      .from(chatArtifact)
      .where(eq(chatArtifact.sessionId, sessionId))
      .orderBy(asc(chatArtifact.createdAt));

    return records.map(toArtifactEntity);
  }

  public async getArtifactsByMessage(messageId: string): Promise<ChatArtifactEntity[]> {
    const records = await this.db
      .select()
      .from(chatArtifact)
      .where(eq(chatArtifact.messageId, messageId))
      .orderBy(asc(chatArtifact.createdAt));

    return records.map(toArtifactEntity);
  }

  public async getArtifact(artifactId: string): Promise<ChatArtifactEntity | null> {
    const [record] = await this.db
      .select()
      .from(chatArtifact)
      .where(eq(chatArtifact.id, artifactId));

    return record ? toArtifactEntity(record) : null;
  }

  public async saveAttachment(params: CreateAttachmentParams): Promise<ChatAttachmentEntity> {
    const id = params.id || `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const [record] = await this.db
      .insert(chatAttachment)
      .values({
        id,
        sessionId: params.sessionId,
        messageId: params.messageId || null,
        userId: params.userId,
        name: params.name,
        storageKey: params.storageKey,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes ?? null,
        uploadStatus: params.uploadStatus || "ready",
        metadata: params.metadata ?? {},
      })
      .returning();

    return toAttachmentEntity(record);
  }

  public async getAttachmentsBySession(sessionId: string, userId: string): Promise<ChatAttachmentEntity[]> {
    const records = await this.db
      .select()
      .from(chatAttachment)
      .where(and(eq(chatAttachment.sessionId, sessionId), eq(chatAttachment.userId, userId)))
      .orderBy(asc(chatAttachment.createdAt));

    return records.map(toAttachmentEntity);
  }

  public async getAttachmentsByMessage(messageId: string, userId: string): Promise<ChatAttachmentEntity[]> {
    const records = await this.db
      .select()
      .from(chatAttachment)
      .where(and(eq(chatAttachment.messageId, messageId), eq(chatAttachment.userId, userId)))
      .orderBy(asc(chatAttachment.createdAt));

    return records.map(toAttachmentEntity);
  }

  public async getAttachment(attachmentId: string, userId: string): Promise<ChatAttachmentEntity | null> {
    const [record] = await this.db
      .select()
      .from(chatAttachment)
      .where(and(eq(chatAttachment.id, attachmentId), eq(chatAttachment.userId, userId)));

    return record ? toAttachmentEntity(record) : null;
  }

  public async updateAttachmentStatus(attachmentId: string, userId: string, status: string): Promise<boolean> {
    const result = await this.db
      .update(chatAttachment)
      .set({ uploadStatus: status })
      .where(and(eq(chatAttachment.id, attachmentId), eq(chatAttachment.userId, userId)));

    return (result.rowCount ?? 0) > 0;
  }
}
