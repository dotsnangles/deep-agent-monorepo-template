import type { CreateChatMessageDTO, ChatStreamRequestDTO, PatchChatLeafDTO, DeleteChatMessageDTO } from "@repo/validators";
import type { MessageNode } from "../lib/tree";

export interface StreamMessageContext {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamRequestParams {
  sessionId: string;
  assistantMessageId: string;
  userMessageId: string | null;
  contextMessages: StreamMessageContext[];
}

export interface TreeFetchResult {
  messages: MessageNode[];
  activeLeafId: string | null;
  title?: string;
}

export interface DeleteSubtreeResult {
  deletedIds: string[];
  activeLeafId: string | null;
}

export interface ChatTransport {
  fetchTree(sessionId: string): Promise<TreeFetchResult>;
  streamResponse(
    params: StreamRequestParams,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
  ): Promise<void>;
  persistNode(dto: CreateChatMessageDTO): Promise<boolean>;
  updateActiveLeaf(sessionId: string, activeLeafId: string): Promise<boolean>;
  deleteSubtree(sessionId: string, messageId: string): Promise<DeleteSubtreeResult | null>;
}

export class HttpChatTransport implements ChatTransport {
  private fetchFn: typeof fetch;

  constructor(fetchFn: typeof fetch = typeof window !== "undefined" ? window.fetch.bind(window) : fetch) {
    this.fetchFn = fetchFn;
  }

  async fetchTree(sessionId: string): Promise<TreeFetchResult> {
    const res = await this.fetchFn(`/api/chat/messages?sessionId=${encodeURIComponent(sessionId)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch message tree for session ${sessionId}: HTTP ${res.status}`);
    }
    const data = await res.json();
    return {
      messages: data.messages || [],
      activeLeafId: data.activeLeafId || null,
      title: data.session?.title || data.title,
    };
  }

  async streamResponse(
    params: StreamRequestParams,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    const payload: ChatStreamRequestDTO = {
      threadId: params.sessionId,
      messages: params.contextMessages,
    };

    const res = await this.fetchFn("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    if (!res.body) {
      throw new Error("No response body received from stream endpoint");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        onChunk(chunk);
      }
    }
  }

  async persistNode(dto: CreateChatMessageDTO): Promise<boolean> {
    try {
      const res = await this.fetchFn("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dto),
      });
      return res.ok;
    } catch (err) {
      console.error("[HttpChatTransport] Failed to persist message node:", err);
      return false;
    }
  }

  async updateActiveLeaf(sessionId: string, activeLeafId: string): Promise<boolean> {
    try {
      const payload: PatchChatLeafDTO = { sessionId, activeLeafId };
      const res = await this.fetchFn("/api/chat/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      console.error("[HttpChatTransport] Failed to update active leaf:", err);
      return false;
    }
  }

  async deleteSubtree(sessionId: string, messageId: string): Promise<DeleteSubtreeResult | null> {
    try {
      const payload: DeleteChatMessageDTO = { sessionId, messageId };
      const res = await this.fetchFn("/api/chat/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.error("[HttpChatTransport] Failed to delete subtree:", err);
      return null;
    }
  }
}

export class FakeChatTransport implements ChatTransport {
  public trees: Map<string, TreeFetchResult> = new Map();
  public persistedNodes: CreateChatMessageDTO[] = [];
  public leafUpdates: Array<{ sessionId: string; activeLeafId: string }> = [];
  public mockStreamChunks: string[] = ["Mock response"];
  public mockStreamDelay: number = 0;
  public mockStreamError: Error | null = null;

  setMockTree(sessionId: string, result: TreeFetchResult) {
    this.trees.set(sessionId, result);
  }

  setMockStreamChunks(chunks: string[]) {
    this.mockStreamChunks = chunks;
  }

  setMockStreamDelay(delayMs: number) {
    this.mockStreamDelay = delayMs;
  }

  setMockStreamError(error: Error | null) {
    this.mockStreamError = error;
  }

  async fetchTree(sessionId: string): Promise<TreeFetchResult> {
    const tree = this.trees.get(sessionId);
    if (tree) {
      return {
        messages: tree.messages.map((m) => ({ ...m })),
        activeLeafId: tree.activeLeafId,
        title: tree.title,
      };
    }
    return { messages: [], activeLeafId: null };
  }

  async streamResponse(
    params: StreamRequestParams,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
  ): Promise<void> {
    if (this.mockStreamError) {
      throw this.mockStreamError;
    }

    for (const chunk of this.mockStreamChunks) {
      if (signal.aborted) {
        break;
      }
      if (this.mockStreamDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.mockStreamDelay));
      }
      if (signal.aborted) {
        break;
      }
      onChunk(chunk);
    }
  }

  async persistNode(dto: CreateChatMessageDTO): Promise<boolean> {
    this.persistedNodes.push({ ...dto });
    return true;
  }

  async updateActiveLeaf(sessionId: string, activeLeafId: string): Promise<boolean> {
    this.leafUpdates.push({ sessionId, activeLeafId });
    const tree = this.trees.get(sessionId);
    if (tree) {
      tree.activeLeafId = activeLeafId;
    }
    return true;
  }

  async deleteSubtree(sessionId: string, messageId: string): Promise<DeleteSubtreeResult | null> {
    return {
      deletedIds: [messageId],
      activeLeafId: null,
    };
  }
}
