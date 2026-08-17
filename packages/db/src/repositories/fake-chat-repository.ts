import type { AttachmentEntity } from "@repo/validators";
import type {
  ChatRepository,
  ChatSessionEntity,
  MessageNode,
  TreeResult,
  DeleteSubtreeResult,
  CreateMessageParams,
  SaveMessageResult,
  CreateSessionParams,
  ForkSessionResult,
  ChatArtifactEntity,
  CreateArtifactParams,
  ChatAttachmentEntity,
  CreateAttachmentParams,
} from "./chat-repository";
import {
  traverseActivePath,
  pruneSubtree,
  resolveActiveLeafAfterPrune,
  createSessionSnippet,
} from "./tree-utils";

export class FakeChatRepository implements ChatRepository {
  private sessions: Map<string, ChatSessionEntity> = new Map();
  private messages: Map<string, MessageNode[]> = new Map();
  private artifacts: Map<string, ChatArtifactEntity> = new Map();
  private attachments: Map<string, ChatAttachmentEntity> = new Map();

  public async getSessions(userId: string): Promise<ChatSessionEntity[]> {
    const userSessions: ChatSessionEntity[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        userSessions.push({ ...session });
      }
    }
    return userSessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  public async getSession(sessionId: string, userId: string): Promise<ChatSessionEntity | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }
    return { ...session };
  }

  public async createSession(params: CreateSessionParams): Promise<ChatSessionEntity> {
    const session: ChatSessionEntity = {
      id: params.id,
      userId: params.userId,
      title: params.title || "새로운 대화",
      activeLeafId: params.activeLeafId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(session.id, session);
    if (!this.messages.has(session.id)) {
      this.messages.set(session.id, []);
    }
    return { ...session };
  }

  public async updateSessionTitle(sessionId: string, userId: string, title: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return false;
    }
    session.title = title.trim();
    session.updatedAt = new Date();
    return true;
  }

  public async updateSessionTitleById(sessionId: string, title: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    session.title = title.trim();
    session.updatedAt = new Date();
    return true;
  }

  public async updateSessionActiveLeaf(sessionId: string, userId: string, activeLeafId: string | null): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return false;
    }
    session.activeLeafId = activeLeafId;
    session.updatedAt = new Date();
    return true;
  }

  public async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return false;
    }
    this.sessions.delete(sessionId);
    this.messages.delete(sessionId);
    return true;
  }

  private getAttachmentsMapForSession(sessionId: string): Map<string, AttachmentEntity[]> {
    const map = new Map<string, AttachmentEntity[]>();
    for (const att of this.attachments.values()) {
      if (att.sessionId === sessionId && att.messageId) {
        const list = map.get(att.messageId) || [];
        list.push({
          id: att.id,
          name: att.name,
          mimeType: att.mimeType,
          size: att.sizeBytes ?? 0,
          s3Key: att.storageKey,
          url: `/api/storage/presigned-url?key=${encodeURIComponent(att.storageKey)}`,
        });
        map.set(att.messageId, list);
      }
    }
    return map;
  }

  private getArtifactsMapForSession(sessionId: string): Map<string, ChatArtifactEntity[]> {
    const map = new Map<string, ChatArtifactEntity[]>();
    for (const art of this.artifacts.values()) {
      if (art.sessionId === sessionId && art.messageId) {
        const list = map.get(art.messageId) || [];
        list.push({ ...art });
        map.set(art.messageId, list);
      }
    }
    return map;
  }

  public async getTree(sessionId: string, userId: string): Promise<TreeResult | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }
    const sessionMessages = this.messages.get(sessionId) || [];
    const attachmentsMap = this.getAttachmentsMapForSession(sessionId);
    const artifactsMap = this.getArtifactsMapForSession(sessionId);
    const clonedMessages = sessionMessages.map((m) => ({
      ...m,
      attachments: attachmentsMap.get(m.id) ?? m.attachments ?? [],
      artifacts: artifactsMap.get(m.id) ?? m.artifacts ?? [],
    }));
    const activePath = traverseActivePath(clonedMessages, session.activeLeafId);

    return {
      sessionId: session.id,
      activeLeafId: session.activeLeafId,
      messages: clonedMessages,
      activePath,
    };
  }

  public async getMessages(sessionId: string, userId: string): Promise<MessageNode[] | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }
    const sessionMessages = this.messages.get(sessionId) || [];
    const attachmentsMap = this.getAttachmentsMapForSession(sessionId);
    const artifactsMap = this.getArtifactsMapForSession(sessionId);
    return sessionMessages
      .map((m) => ({
        ...m,
        attachments: attachmentsMap.get(m.id) ?? m.attachments ?? [],
        artifacts: artifactsMap.get(m.id) ?? m.artifacts ?? [],
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  public async forkSession(
    sourceSessionId: string,
    fromMessageId: string,
    userId: string,
    newTitle?: string
  ): Promise<ForkSessionResult | null> {
    const sourceSession = this.sessions.get(sourceSessionId);
    if (!sourceSession || sourceSession.userId !== userId) {
      return null;
    }

    const sourceMessages = this.messages.get(sourceSessionId) || [];
    const msgMap = new Map<string, MessageNode>(sourceMessages.map((m) => [m.id, m]));

    const targetMsg = msgMap.get(fromMessageId);
    if (!targetMsg) {
      return null;
    }

    // Extract lineage from fromMessageId back to root
    const lineage: MessageNode[] = [];
    const visited = new Set<string>();
    let curr: MessageNode | undefined = targetMsg;

    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      lineage.push(curr);
      curr = curr.parentId ? msgMap.get(curr.parentId) : undefined;
    }
    lineage.reverse(); // [root, ..., targetMsg]

    const newSessionId = crypto.randomUUID();
    const title = newTitle || `${sourceSession.title} (분기)`;

    // Map old message IDs to new cloned IDs
    const idMap = new Map<string, string>();
    lineage.forEach((m) => {
      idMap.set(m.id, crypto.randomUUID());
    });

    const clonedMessages: MessageNode[] = lineage.map((m, idx) => {
      const clonedId = idMap.get(m.id)!;
      return {
        ...m,
        id: clonedId,
        sessionId: newSessionId,
        parentId: m.parentId ? idMap.get(m.parentId) ?? null : null,
        attachments: m.attachments ? [...m.attachments] : [],
        createdAt: new Date(m.createdAt.getTime() + idx),
      };
    });

    const lastClonedId = idMap.get(fromMessageId) || null;

    const newSession: ChatSessionEntity = {
      id: newSessionId,
      userId,
      title,
      activeLeafId: lastClonedId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(newSessionId, newSession);
    this.messages.set(newSessionId, clonedMessages);

    // Replicate associated artifacts
    for (const art of this.artifacts.values()) {
      if (art.sessionId === sourceSessionId && art.messageId && idMap.has(art.messageId)) {
        const clonedArtId = crypto.randomUUID();
        this.artifacts.set(clonedArtId, {
          ...art,
          id: clonedArtId,
          sessionId: newSessionId,
          messageId: idMap.get(art.messageId)!,
          createdAt: new Date(),
        });
      }
    }

    // Replicate associated user attachments
    for (const att of this.attachments.values()) {
      if (att.sessionId === sourceSessionId && att.messageId && idMap.has(att.messageId)) {
        const clonedAttId = crypto.randomUUID();
        this.attachments.set(clonedAttId, {
          ...att,
          id: clonedAttId,
          sessionId: newSessionId,
          messageId: idMap.get(att.messageId)!,
          createdAt: new Date(),
        });
      }
    }

    return {
      session: { ...newSession },
      messages: clonedMessages.map((m) => ({ ...m })),
    };
  }

  public async saveMessage(params: CreateMessageParams, userId: string): Promise<SaveMessageResult | null> {
    let session = this.sessions.get(params.sessionId);
    let isNewSession = false;

    if (!session) {
      isNewSession = true;
      const snippet = createSessionSnippet(params.content);
      session = {
        id: params.sessionId,
        userId,
        title: snippet,
        activeLeafId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.sessions.set(session.id, session);
      this.messages.set(session.id, []);
    } else if (session.userId !== userId) {
      return null;
    }

    const messageId = params.id || crypto.randomUUID();
    const messageNode: MessageNode = {
      id: messageId,
      sessionId: params.sessionId,
      parentId: params.parentId || null,
      role: params.role,
      content: params.content,
      attachments: params.attachments ? [...params.attachments] : [],
      createdAt: new Date(),
    };

    if (params.attachments && params.attachments.length > 0) {
      for (const att of params.attachments) {
        const s3Key =
          att.s3Key ||
          att.url?.split("?")[0] ||
          `attachments/${userId}/${params.sessionId}/${att.id}_${att.name}`;
        this.attachments.set(att.id, {
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
          createdAt: new Date(),
        });
      }
    }

    if (params.artifacts && params.artifacts.length > 0) {
      for (const art of params.artifacts) {
        this.artifacts.set(art.id, {
          id: art.id,
          sessionId: params.sessionId,
          messageId,
          name: art.name,
          storageKey: art.storageKey,
          mimeType: art.mimeType,
          sizeBytes: art.sizeBytes,
          metadata: art.metadata || {},
          createdAt: new Date(),
        });
      }
    }

    const sessionMessages = this.messages.get(params.sessionId) || [];
    sessionMessages.push(messageNode);
    this.messages.set(params.sessionId, sessionMessages);

    session.activeLeafId = messageId;
    session.updatedAt = new Date();

    return {
      message: { ...messageNode },
      session: { ...session },
      isNewSession,
    };
  }

  public async deleteSubtree(sessionId: string, messageId: string, userId: string): Promise<DeleteSubtreeResult | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }

    const sessionMessages = this.messages.get(sessionId) || [];
    const targetNode = sessionMessages.find((n) => n.id === messageId);
    if (!targetNode) {
      return null;
    }

    const { remainingNodes, deletedIds } = pruneSubtree(sessionMessages, messageId);
    this.messages.set(sessionId, remainingNodes);

    const newActiveLeafId = resolveActiveLeafAfterPrune(
      remainingNodes,
      session.activeLeafId,
      deletedIds,
      targetNode.parentId
    );

    session.activeLeafId = newActiveLeafId;
    session.updatedAt = new Date();

    return {
      deletedIds,
      activeLeafId: newActiveLeafId,
    };
  }

  public async saveArtifact(params: CreateArtifactParams): Promise<ChatArtifactEntity> {
    const id = params.id || crypto.randomUUID();
    const artifact: ChatArtifactEntity = {
      id,
      sessionId: params.sessionId,
      messageId: params.messageId || null,
      name: params.name,
      storageKey: params.storageKey,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes ?? null,
      metadata: params.metadata ? { ...params.metadata } : {},
      createdAt: new Date(),
    };
    this.artifacts.set(id, artifact);
    return { ...artifact };
  }

  public async getArtifactsBySession(sessionId: string): Promise<ChatArtifactEntity[]> {
    const list: ChatArtifactEntity[] = [];
    for (const art of this.artifacts.values()) {
      if (art.sessionId === sessionId) {
        list.push({ ...art });
      }
    }
    return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  public async getArtifactsByMessage(messageId: string): Promise<ChatArtifactEntity[]> {
    const list: ChatArtifactEntity[] = [];
    for (const art of this.artifacts.values()) {
      if (art.messageId === messageId) {
        list.push({ ...art });
      }
    }
    return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  public async getArtifact(artifactId: string): Promise<ChatArtifactEntity | null> {
    const art = this.artifacts.get(artifactId);
    return art ? { ...art } : null;
  }

  public async saveAttachment(params: CreateAttachmentParams): Promise<ChatAttachmentEntity> {
    const id = params.id || crypto.randomUUID();
    const attachment: ChatAttachmentEntity = {
      id,
      sessionId: params.sessionId,
      messageId: params.messageId ?? null,
      userId: params.userId,
      name: params.name,
      storageKey: params.storageKey,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes ?? null,
      uploadStatus: params.uploadStatus || "ready",
      metadata: params.metadata ? { ...params.metadata } : {},
      createdAt: new Date(),
    };
    this.attachments.set(id, attachment);
    return { ...attachment };
  }

  public async getAttachmentsBySession(sessionId: string, userId: string): Promise<ChatAttachmentEntity[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return [];
    }
    const list: ChatAttachmentEntity[] = [];
    for (const att of this.attachments.values()) {
      if (att.sessionId === sessionId && att.userId === userId) {
        list.push({ ...att });
      }
    }
    return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  public async getAttachmentsByMessage(messageId: string, userId: string): Promise<ChatAttachmentEntity[]> {
    const list: ChatAttachmentEntity[] = [];
    for (const att of this.attachments.values()) {
      if (att.messageId === messageId && att.userId === userId) {
        list.push({ ...att });
      }
    }
    return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  public async getAttachment(attachmentId: string, userId: string): Promise<ChatAttachmentEntity | null> {
    const att = this.attachments.get(attachmentId);
    if (!att || att.userId !== userId) {
      return null;
    }
    return { ...att };
  }

  public async updateAttachmentStatus(attachmentId: string, userId: string, status: string): Promise<boolean> {
    const att = this.attachments.get(attachmentId);
    if (!att || att.userId !== userId) {
      return false;
    }
    att.uploadStatus = status;
    return true;
  }

  public clear(): void {
    this.sessions.clear();
    this.messages.clear();
    this.artifacts.clear();
    this.attachments.clear();
  }
}
