import type {
  ChatRepository,
  ChatSessionEntity,
  MessageNode,
  TreeResult,
  DeleteSubtreeResult,
  CreateMessageParams,
  SaveMessageResult,
  CreateSessionParams,
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

  public async getTree(sessionId: string, userId: string): Promise<TreeResult | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      return null;
    }
    const sessionMessages = this.messages.get(sessionId) || [];
    const clonedMessages = sessionMessages.map((m) => ({ ...m }));
    const activePath = traverseActivePath(clonedMessages, session.activeLeafId);

    return {
      sessionId: session.id,
      activeLeafId: session.activeLeafId,
      messages: clonedMessages,
      activePath,
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

    const messageId = params.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const messageNode: MessageNode = {
      id: messageId,
      sessionId: params.sessionId,
      parentId: params.parentId || null,
      role: params.role,
      content: params.content,
      createdAt: new Date(),
    };

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

  public clear(): void {
    this.sessions.clear();
    this.messages.clear();
  }
}
