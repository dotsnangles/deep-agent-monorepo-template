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

function buildChildrenMap(nodes: MessageNode[]): Map<string | null, MessageNode[]> {
  const map = new Map<string | null, MessageNode[]>();
  for (const node of nodes) {
    const parent = node.parentId;
    if (!map.has(parent)) {
      map.set(parent, []);
    }
    map.get(parent)!.push(node);
  }
  return map;
}

function traverseActivePath(nodes: MessageNode[], activeLeafId: string | null): MessageNode[] {
  if (!activeLeafId || nodes.length === 0) return [];

  const nodeMap = new Map<string, MessageNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const path: MessageNode[] = [];
  let current: MessageNode | undefined = nodeMap.get(activeLeafId);

  while (current) {
    path.unshift(current);
    if (!current.parentId) break;
    current = nodeMap.get(current.parentId);
  }

  return path;
}

function pruneSubtree(nodes: MessageNode[], targetNodeId: string): { remainingNodes: MessageNode[]; deletedIds: string[] } {
  const childrenMap = buildChildrenMap(nodes);
  const deletedSet = new Set<string>();
  const queue = [targetNodeId];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    deletedSet.add(currId);
    const children = childrenMap.get(currId) || [];
    for (const child of children) {
      queue.push(child.id);
    }
  }

  const deletedIds = Array.from(deletedSet);
  const remainingNodes = nodes.filter((n) => !deletedSet.has(n.id));

  return { remainingNodes, deletedIds };
}

function findDeepestDescendant(nodes: MessageNode[], startNodeId: string): string {
  const childrenMap = buildChildrenMap(nodes);
  let currentId = startNodeId;
  while (true) {
    const children = childrenMap.get(currentId) || [];
    if (children.length === 0) break;
    currentId = children[children.length - 1].id;
  }
  return currentId;
}

function findNewActiveLeafAfterPrune(remainingNodes: MessageNode[], parentId: string | null): string | null {
  if (remainingNodes.length === 0) return null;

  if (parentId) {
    const parentExists = remainingNodes.some((n) => n.id === parentId);
    if (parentExists) {
      return findDeepestDescendant(remainingNodes, parentId);
    }
  }

  const roots = remainingNodes.filter((n) => !n.parentId);
  if (roots.length > 0) {
    return findDeepestDescendant(remainingNodes, roots[roots.length - 1].id);
  }

  return remainingNodes[remainingNodes.length - 1].id;
}

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
      const snippet = params.content.slice(0, 30).trim() || "새로운 대화";
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

    // Only recompute activeLeafId if the pruned branch contained the active leaf
    const isCurrentLeafDeleted = session.activeLeafId !== null && deletedIds.includes(session.activeLeafId);
    const newActiveLeafId = isCurrentLeafDeleted
      ? findNewActiveLeafAfterPrune(remainingNodes, targetNode.parentId)
      : session.activeLeafId;

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
