import type {
  CreateChatMessageDTO,
  ChatStreamRequestDTO,
  PatchChatLeafDTO,
  DeleteChatMessageDTO,
  ResumeActionDTO,
  AttachmentEntity,
  ChatArtifactEntity,
} from "@repo/validators";
import type { MessageNode, ToolApprovalRequest, TodoItem } from "../lib/types";

export interface StreamMessageContext {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: AttachmentEntity[];
}

export interface StreamRequestParams {
  sessionId: string;
  assistantMessageId: string;
  userMessageId: string | null;
  contextMessages: StreamMessageContext[];
  resume?: ResumeActionDTO;
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

export interface ForkSessionResult {
  session: { id: string; title: string };
  messages: MessageNode[];
}

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onReasoningChunk?: (chunk: string) => void;
  onApprovalRequest?: (approval: ToolApprovalRequest) => void;
  onTodoUpdate?: (todos: TodoItem[]) => void;
  onSubagentStart?: (subagent: string, task: string, runId?: string) => void;
  onSubagentEnd?: (subagent: string, output: any, runId?: string) => void;
  onToolStart?: (tool: string, input: any, runId?: string) => void;
  onToolEnd?: (tool: string, output: any, runId?: string) => void;
  onArtifactCreated?: (artifact: ChatArtifactEntity & { url: string }) => void;
  onDone?: (finishReason: string) => void;
  onError?: (error: string) => void;
}

export interface ChatTransport {
  fetchTree(sessionId: string): Promise<TreeFetchResult>;
  fetchMessages?(sessionId: string): Promise<TreeFetchResult>;
  streamResponse(
    params: StreamRequestParams,
    callbacks: StreamCallbacks | ((chunk: string) => void),
    signal: AbortSignal
  ): Promise<void>;
  persistNode(dto: CreateChatMessageDTO): Promise<boolean>;
  updateActiveLeaf(sessionId: string, activeLeafId: string): Promise<boolean>;
  deleteSubtree(sessionId: string, messageId: string): Promise<DeleteSubtreeResult | null>;
  forkSession(
    sessionId: string,
    fromMessageId: string,
    title?: string
  ): Promise<ForkSessionResult | null>;
}

export class HttpChatTransport implements ChatTransport {
  private fetchFn: typeof fetch;

  constructor(
    fetchFn: typeof fetch = typeof window !== "undefined"
      ? window.fetch.bind(window)
      : fetch
  ) {
    this.fetchFn = fetchFn;
  }

  async fetchTree(sessionId: string): Promise<TreeFetchResult> {
    const res = await this.fetchFn(
      `/api/chat/messages?sessionId=${encodeURIComponent(sessionId)}`
    );
    if (!res.ok) {
      throw new Error(
        `Failed to fetch message tree for session ${sessionId}: HTTP ${res.status}`
      );
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
    callbacks: StreamCallbacks | ((chunk: string) => void),
    signal: AbortSignal
  ): Promise<void> {
    const cb: StreamCallbacks =
      typeof callbacks === "function" ? { onToken: callbacks } : callbacks;

    const payload: ChatStreamRequestDTO = {
      threadId: params.sessionId,
      messages: params.contextMessages,
      resume: params.resume,
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
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process SSE blocks separated by double newlines
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        if (!block.trim()) continue;

        let eventType = "token";
        let rawData = "";

        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            rawData = line.slice(6).trim();
          }
        }

        if (!rawData) {
          // Fallback if not standard SSE
          if (block && !block.startsWith("event: ")) {
            cb.onToken?.(block);
          }
          continue;
        }

        try {
          const parsed = JSON.parse(rawData);
          if (eventType === "token" && parsed.content) {
            cb.onToken?.(parsed.content);
          } else if (eventType === "reasoning" || parsed.reasoning || parsed.thought) {
            cb.onReasoningChunk?.(parsed.reasoning || parsed.thought || parsed.content || rawData);
          } else if (eventType === "todo_update") {
            cb.onTodoUpdate?.(parsed.todos || []);
          } else if (eventType === "subagent_start") {
            cb.onSubagentStart?.(parsed.subagent, parsed.task, parsed.runId || parsed.run_id);
          } else if (eventType === "subagent_end") {
            cb.onSubagentEnd?.(parsed.subagent, parsed.output, parsed.runId || parsed.run_id);
          } else if (eventType === "tool_start") {
            cb.onToolStart?.(parsed.tool, parsed.input, parsed.runId || parsed.run_id);
          } else if (eventType === "tool_end") {
            cb.onToolEnd?.(parsed.tool, parsed.output, parsed.runId || parsed.run_id);
          } else if (eventType === "approval_request") {
            cb.onApprovalRequest?.({
              toolCallId: parsed.toolCallId || parsed.tool_call_id || "",
              tool: parsed.tool || "tool",
              input: parsed.input || {},
              description: parsed.description,
              status: "pending",
            });
          } else if (eventType === "artifact_created") {
            cb.onArtifactCreated?.({
              id: parsed.id,
              sessionId: parsed.sessionId || parsed.session_id,
              messageId: parsed.messageId || parsed.message_id || null,
              name: parsed.name,
              url: parsed.url,
              storageKey: parsed.storageKey || parsed.storage_key,
              mimeType: parsed.mimeType || parsed.mime_type,
              sizeBytes: parsed.sizeBytes ?? parsed.size_bytes ?? null,
              metadata: parsed.metadata || {},
              createdAt: parsed.createdAt ? new Date(parsed.createdAt) : new Date(),
            });
          } else if (eventType === "done") {
            cb.onDone?.(parsed.finish_reason || "stop");
          } else if (eventType === "error") {
            cb.onError?.(parsed.message || "Agent execution error");
          }
        } catch {
          // If JSON parse fails, treat raw payload as string token
          cb.onToken?.(rawData);
        }
      }
    }

    // Process leftover buffer if any
    if (buffer.trim()) {
      try {
        if (buffer.includes("data: ")) {
          const dataMatch = buffer.match(/data:\s*(.+)/);
          if (dataMatch?.[1]) {
            const parsed = JSON.parse(dataMatch[1]);
            if (parsed.content) cb.onToken?.(parsed.content);
          }
        } else {
          cb.onToken?.(buffer);
        }
      } catch {
        cb.onToken?.(buffer);
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

  async deleteSubtree(
    sessionId: string,
    messageId: string
  ): Promise<DeleteSubtreeResult | null> {
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

  async forkSession(
    sessionId: string,
    fromMessageId: string,
    title?: string
  ): Promise<ForkSessionResult | null> {
    try {
      const res = await this.fetchFn(
        `/api/chat/sessions/${encodeURIComponent(sessionId)}/fork`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromMessageId, title }),
        }
      );
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (err) {
      console.error("[HttpChatTransport] Failed to fork session:", err);
      return null;
    }
  }
}

export class FakeChatTransport implements ChatTransport {
  public trees: Map<string, TreeFetchResult> = new Map();
  public persistedNodes: CreateChatMessageDTO[] = [];
  public leafUpdates: Array<{ sessionId: string; activeLeafId: string }> = [];
  public mockStreamChunks: string[] = ["Mock response"];
  public mockApprovalRequest: ToolApprovalRequest | null = null;
  public mockResumeChunks: string[] = ["Resumed response"];
  public mockTodos: TodoItem[] | null = null;
  public mockSubagents: Array<{ subagent: string; task: string; output?: any }> | null = null;
  public mockArtifacts: Array<ChatArtifactEntity & { url: string }> | null = null;
  public mockStreamDelay: number = 0;
  public mockStreamError: Error | null = null;

  setMockTree(sessionId: string, result: TreeFetchResult) {
    this.trees.set(sessionId, result);
  }

  setMockStreamChunks(chunks: string[]) {
    this.mockStreamChunks = chunks;
  }

  setMockApprovalRequest(req: ToolApprovalRequest | null) {
    this.mockApprovalRequest = req;
  }

  setMockTodos(todos: TodoItem[] | null) {
    this.mockTodos = todos;
  }

  setMockSubagents(subagents: Array<{ subagent: string; task: string; output?: any }> | null) {
    this.mockSubagents = subagents;
  }

  setMockArtifacts(artifacts: Array<ChatArtifactEntity & { url: string }> | null) {
    this.mockArtifacts = artifacts;
  }

  setMockResumeChunks(chunks: string[]) {
    this.mockResumeChunks = chunks;
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
    callbacks: StreamCallbacks | ((chunk: string) => void),
    signal: AbortSignal
  ): Promise<void> {
    if (this.mockStreamError) {
      throw this.mockStreamError;
    }

    const cb: StreamCallbacks =
      typeof callbacks === "function" ? { onToken: callbacks } : callbacks;

    if (params.resume) {
      for (const chunk of this.mockResumeChunks) {
        if (signal.aborted) break;
        if (this.mockStreamDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.mockStreamDelay));
        }
        if (signal.aborted) break;
        cb.onToken?.(chunk);
      }
      cb.onDone?.("stop");
      return;
    }

    if (this.mockApprovalRequest) {
      cb.onApprovalRequest?.({ ...this.mockApprovalRequest });
      cb.onDone?.("interrupt");
      return;
    }

    if (this.mockTodos) {
      cb.onTodoUpdate?.(this.mockTodos);
    }

    if (this.mockSubagents) {
      for (const sub of this.mockSubagents) {
        cb.onSubagentStart?.(sub.subagent, sub.task);
        if (sub.output) {
          cb.onSubagentEnd?.(sub.subagent, sub.output);
        }
      }
    }

    for (const chunk of this.mockStreamChunks) {
      if (signal.aborted) break;
      if (this.mockStreamDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.mockStreamDelay));
      }
      if (signal.aborted) break;
      cb.onToken?.(chunk);
    }

    if (this.mockArtifacts) {
      for (const art of this.mockArtifacts) {
        cb.onArtifactCreated?.(art);
      }
    }

    cb.onDone?.("stop");
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

  async deleteSubtree(
    sessionId: string,
    messageId: string
  ): Promise<DeleteSubtreeResult | null> {
    return {
      deletedIds: [messageId],
      activeLeafId: null,
    };
  }

  async forkSession(
    sessionId: string,
    fromMessageId: string,
    title?: string
  ): Promise<ForkSessionResult | null> {
    const tree = this.trees.get(sessionId);
    if (!tree) return null;
    const targetIdx = tree.messages.findIndex((m) => m.id === fromMessageId);
    if (targetIdx === -1) return null;

    const sliced = tree.messages.slice(0, targetIdx + 1);
    const newSessionId = `sess_fork_${Date.now()}`;
    const newTitle = title || `${tree.title || "새로운 대화"} (분기)`;
    const lastId = sliced[sliced.length - 1]?.id || null;

    const forkedTree: TreeFetchResult = {
      messages: sliced.map((m) => ({ ...m, sessionId: newSessionId })),
      activeLeafId: lastId,
      title: newTitle,
    };
    this.trees.set(newSessionId, forkedTree);

    return {
      session: { id: newSessionId, title: newTitle },
      messages: forkedTree.messages,
    };
  }
}
