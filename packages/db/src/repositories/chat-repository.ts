import type { AttachmentEntity } from "@repo/validators";

export interface ChatSessionEntity {
  id: string;
  userId: string;
  title: string;
  activeLeafId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageNode {
  id: string;
  sessionId: string;
  parentId: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: AttachmentEntity[];
  createdAt: Date;
}

export interface TreeResult {
  sessionId: string;
  activeLeafId: string | null;
  messages: MessageNode[];
  activePath: MessageNode[];
}

export interface DeleteSubtreeResult {
  deletedIds: string[];
  activeLeafId: string | null;
}

export interface CreateMessageParams {
  id?: string;
  sessionId: string;
  parentId?: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: AttachmentEntity[];
}

export interface SaveMessageResult {
  message: MessageNode;
  session: ChatSessionEntity;
  isNewSession: boolean;
}

export interface CreateSessionParams {
  id: string;
  userId: string;
  title?: string;
  activeLeafId?: string | null;
}

export interface ForkSessionResult {
  session: ChatSessionEntity;
  messages: MessageNode[];
}

export interface ChatArtifactEntity {
  id: string;
  sessionId: string;
  messageId: string | null;
  name: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateArtifactParams {
  id?: string;
  sessionId: string;
  messageId?: string | null;
  name: string;
  storageKey: string;
  mimeType: string;
  sizeBytes?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ChatRepository {
  getSessions(userId: string): Promise<ChatSessionEntity[]>;
  getSession(sessionId: string, userId: string): Promise<ChatSessionEntity | null>;
  createSession(params: CreateSessionParams): Promise<ChatSessionEntity>;
  updateSessionTitle(sessionId: string, userId: string, title: string): Promise<boolean>;
  updateSessionTitleById(sessionId: string, title: string): Promise<boolean>;
  updateSessionActiveLeaf(sessionId: string, userId: string, activeLeafId: string | null): Promise<boolean>;
  deleteSession(sessionId: string, userId: string): Promise<boolean>;
  getTree(sessionId: string, userId: string): Promise<TreeResult | null>;
  getMessages(sessionId: string, userId: string): Promise<MessageNode[] | null>;
  saveMessage(params: CreateMessageParams, userId: string): Promise<SaveMessageResult | null>;
  deleteSubtree(sessionId: string, messageId: string, userId: string): Promise<DeleteSubtreeResult | null>;
  forkSession(
    sourceSessionId: string,
    fromMessageId: string,
    userId: string,
    newTitle?: string
  ): Promise<ForkSessionResult | null>;
  saveArtifact(params: CreateArtifactParams): Promise<ChatArtifactEntity>;
  getArtifactsBySession(sessionId: string): Promise<ChatArtifactEntity[]>;
  getArtifactsByMessage(messageId: string): Promise<ChatArtifactEntity[]>;
  getArtifact(artifactId: string): Promise<ChatArtifactEntity | null>;
}
