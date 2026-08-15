import type {
  MessageNode,
  BranchInfo,
} from "../lib/tree";
import {
  traverseActivePath,
  getBranchInfo,
  pruneSubtree,
  findNewActiveLeafAfterPrune,
  findDeepestDescendant,
} from "../lib/tree";
import type { ChatTransport, StreamMessageContext } from "./transport";
import { HttpChatTransport } from "./transport";

export interface ChatEngineOptions {
  sessionId: string;
  transport?: ChatTransport;
  initialNodes?: MessageNode[];
  initialActiveLeafId?: string | null;
  onSessionCreated?: (sessionId: string, title?: string) => void;
}

export interface ChatEngineState {
  sessionId: string;
  allNodes: MessageNode[];
  activeLeafId: string | null;
  activePath: MessageNode[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  generatingAssistantId: string | null;
}

function generateNodeId(prefix: "user" | "asst"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export class ChatEngine {
  private sessionId: string;
  private transport: ChatTransport;
  private onSessionCreated?: (sessionId: string, title?: string) => void;

  private state: ChatEngineState;
  private listeners: Set<() => void> = new Set();
  private abortController: AbortController | null = null;
  private isSending: boolean = false;

  constructor(options: ChatEngineOptions) {
    this.sessionId = options.sessionId;
    this.transport = options.transport || new HttpChatTransport();
    this.onSessionCreated = options.onSessionCreated;

    const initialNodes = options.initialNodes || [];
    const initialLeaf = options.initialActiveLeafId || null;

    this.state = {
      sessionId: options.sessionId,
      allNodes: initialNodes,
      activeLeafId: initialLeaf,
      activePath: traverseActivePath(initialNodes, initialLeaf),
      isLoading: initialNodes.length === 0,
      isGenerating: false,
      error: null,
      generatingAssistantId: null,
    };
  }

  public getState(): ChatEngineState {
    return this.state;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    // Recompute activePath on every state change
    this.state = {
      ...this.state,
      activePath: traverseActivePath(this.state.allNodes, this.state.activeLeafId),
    };
    for (const listener of this.listeners) {
      listener();
    }
  }

  private buildContextMessages(activeLeafId: string, excludeId?: string): StreamMessageContext[] {
    const activePath = traverseActivePath(this.state.allNodes, activeLeafId);
    return activePath
      .filter((n) => n.id !== excludeId)
      .map((n) => ({ role: n.role, content: n.content }));
  }

  public async loadTree(): Promise<void> {
    if (!this.sessionId) return;
    this.state = { ...this.state, isLoading: true, error: null };
    this.notify();

    try {
      const result = await this.transport.fetchTree(this.sessionId);
      this.state = {
        ...this.state,
        allNodes: result.messages,
        activeLeafId: result.activeLeafId,
        isLoading: false,
      };
      this.notify();
    } catch (err: any) {
      console.error(`[ChatEngine] Failed to load message tree for session ${this.sessionId}:`, err);
      this.state = {
        ...this.state,
        isLoading: false,
        error: err?.message || "Failed to load chat history",
      };
      this.notify();
    }
  }

  public async send(content: string, titleSnippet?: string): Promise<void> {
    if (!content.trim() || this.isSending) return;
    this.isSending = true;

    const userMessageId = generateNodeId("user");
    const assistantMessageId = generateNodeId("asst");
    const parentId = this.state.activeLeafId;

    const userNode: MessageNode = {
      id: userMessageId,
      sessionId: this.sessionId,
      parentId,
      role: "user",
      content: content.trim(),
      createdAt: new Date(),
      status: "complete",
    };

    const assistantNode: MessageNode = {
      id: assistantMessageId,
      sessionId: this.sessionId,
      parentId: userMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
      status: "streaming",
    };

    // Optimistically append user and empty assistant node
    this.state = {
      ...this.state,
      allNodes: [...this.state.allNodes, userNode, assistantNode],
      activeLeafId: assistantMessageId,
      isGenerating: true,
      generatingAssistantId: assistantMessageId,
      error: null,
    };
    this.notify();

    // Persist user node to database
    await this.transport.persistNode({
      id: userNode.id,
      sessionId: this.sessionId,
      parentId: userNode.parentId,
      role: "user",
      content: userNode.content,
    });

    // Notify session created if lazy
    if (this.onSessionCreated) {
      this.onSessionCreated(this.sessionId, content.slice(0, 30));
    }

    const contextMessages = this.buildContextMessages(assistantMessageId, assistantMessageId);

    await this.executeStream({
      assistantMessageId,
      userMessageId,
      contextMessages,
      titleSnippet,
    });

    this.isSending = false;
  }

  public async forkAndEdit(targetNodeId: string, newContent: string): Promise<void> {
    if (!newContent.trim() || this.isSending) return;
    this.isSending = true;

    const targetNode = this.state.allNodes.find((n) => n.id === targetNodeId);
    if (!targetNode || targetNode.role !== "user") {
      this.isSending = false;
      return;
    }

    const newUserNodeId = generateNodeId("user");
    const newAssistantNodeId = generateNodeId("asst");

    const newUserNode: MessageNode = {
      id: newUserNodeId,
      sessionId: this.sessionId,
      parentId: targetNode.parentId, // sibling of targetNode
      role: "user",
      content: newContent.trim(),
      createdAt: new Date(),
      status: "complete",
    };

    const newAssistantNode: MessageNode = {
      id: newAssistantNodeId,
      sessionId: this.sessionId,
      parentId: newUserNodeId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
      status: "streaming",
    };

    this.state = {
      ...this.state,
      allNodes: [...this.state.allNodes, newUserNode, newAssistantNode],
      activeLeafId: newAssistantNodeId,
      isGenerating: true,
      generatingAssistantId: newAssistantNodeId,
      error: null,
    };
    this.notify();

    // Persist new user node
    await this.transport.persistNode({
      id: newUserNode.id,
      sessionId: this.sessionId,
      parentId: newUserNode.parentId,
      role: "user",
      content: newUserNode.content,
    });

    const contextMessages = this.buildContextMessages(newAssistantNodeId, newAssistantNodeId);

    await this.executeStream({
      assistantMessageId: newAssistantNodeId,
      userMessageId: newUserNodeId,
      contextMessages,
    });

    this.isSending = false;
  }

  public async regenerate(assistantNodeId: string): Promise<void> {
    if (this.isSending) return;
    this.isSending = true;

    const targetAssistant = this.state.allNodes.find((n) => n.id === assistantNodeId);
    if (!targetAssistant || targetAssistant.role !== "assistant") {
      this.isSending = false;
      return;
    }

    const newAssistantNodeId = generateNodeId("asst");
    const newAssistantNode: MessageNode = {
      id: newAssistantNodeId,
      sessionId: this.sessionId,
      parentId: targetAssistant.parentId, // same parent user node
      role: "assistant",
      content: "",
      createdAt: new Date(),
      status: "streaming",
    };

    this.state = {
      ...this.state,
      allNodes: [...this.state.allNodes, newAssistantNode],
      activeLeafId: newAssistantNodeId,
      isGenerating: true,
      generatingAssistantId: newAssistantNodeId,
      error: null,
    };
    this.notify();

    const contextMessages = this.buildContextMessages(newAssistantNodeId, newAssistantNodeId);

    await this.executeStream({
      assistantMessageId: newAssistantNodeId,
      userMessageId: targetAssistant.parentId,
      contextMessages,
    });

    this.isSending = false;
  }

  public async retry(nodeId?: string): Promise<void> {
    if (this.isSending) return;
    const targetNodeId = nodeId || this.state.generatingAssistantId || this.state.activeLeafId;
    if (!targetNodeId) return;

    const targetNode = this.state.allNodes.find((n) => n.id === targetNodeId);
    if (!targetNode) return;

    if (targetNode.role === "assistant") {
      this.isSending = true;
      // Reset content and status
      this.state = {
        ...this.state,
        allNodes: this.state.allNodes.map((n) =>
          n.id === targetNode.id ? { ...n, content: "", status: "streaming", error: null } : n
        ),
        activeLeafId: targetNode.id,
        isGenerating: true,
        generatingAssistantId: targetNode.id,
        error: null,
      };
      this.notify();

      const contextMessages = this.buildContextMessages(targetNode.id, targetNode.id);

      await this.executeStream({
        assistantMessageId: targetNode.id,
        userMessageId: targetNode.parentId,
        contextMessages,
      });

      this.isSending = false;
    } else if (targetNode.role === "user") {
      // If retrying a user node, regenerate its assistant response
      const childAssistant = this.state.allNodes.find(
        (n) => n.parentId === targetNode.id && n.role === "assistant"
      );
      if (childAssistant) {
        await this.retry(childAssistant.id);
      }
    }
  }


  public async selectBranch(nodeId: string, direction: "prev" | "next"): Promise<void> {
    const branchInfo = getBranchInfo(nodeId, this.state.allNodes);
    if (branchInfo.totalBranches <= 1) return;

    const idx = branchInfo.siblingIds.indexOf(nodeId);
    if (idx === -1) return;

    const nextIndex =
      direction === "prev"
        ? (idx - 1 + branchInfo.totalBranches) % branchInfo.totalBranches
        : (idx + 1) % branchInfo.totalBranches;

    const targetSiblingId = branchInfo.siblingIds[nextIndex];
    if (!targetSiblingId) return;

    const targetNode = this.state.allNodes.find((n) => n.id === targetSiblingId);
    if (!targetNode) return;

    const newLeafId = findDeepestDescendant(this.state.allNodes, targetSiblingId);
    this.state = {
      ...this.state,
      activeLeafId: newLeafId,
    };
    this.notify();

    await this.transport.updateActiveLeaf(this.sessionId, newLeafId);
  }

  public async deleteNode(nodeId: string): Promise<void> {
    const targetNode = this.state.allNodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    const { remainingNodes, deletedIds } = pruneSubtree(this.state.allNodes, nodeId);
    const newLeafId = findNewActiveLeafAfterPrune(remainingNodes, targetNode.parentId);

    this.state = {
      ...this.state,
      allNodes: remainingNodes,
      activeLeafId: newLeafId,
    };
    this.notify();

    await this.transport.deleteSubtree(this.sessionId, nodeId);
  }

  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  public getBranchInfo(nodeId: string): BranchInfo {
    return getBranchInfo(nodeId, this.state.allNodes);
  }


  private async executeStream(params: {
    assistantMessageId: string;
    userMessageId: string | null;
    contextMessages: StreamMessageContext[];
    titleSnippet?: string;
  }): Promise<void> {
    this.abortController = new AbortController();
    let accumulatedContent = "";

    try {
      await this.transport.streamResponse(
        {
          sessionId: this.sessionId,
          assistantMessageId: params.assistantMessageId,
          userMessageId: params.userMessageId,
          contextMessages: params.contextMessages,
          titleSnippet: params.titleSnippet,
        },
        (chunk) => {
          accumulatedContent += chunk;
          this.state = {
            ...this.state,
            allNodes: this.state.allNodes.map((n) =>
              n.id === params.assistantMessageId
                ? { ...n, content: accumulatedContent, status: "streaming" }
                : n
            ),
          };
          this.notify();
        },
        this.abortController.signal
      );

      // Successfully finished stream
      this.state = {
        ...this.state,
        allNodes: this.state.allNodes.map((n) =>
          n.id === params.assistantMessageId
            ? { ...n, content: accumulatedContent, status: "complete" }
            : n
        ),
        isGenerating: false,
        generatingAssistantId: null,
      };
      this.notify();
    } catch (err: any) {
      const isAborted = this.abortController.signal.aborted || err?.name === "AbortError";
      if (isAborted) {
        // User aborted: mark complete with partial content
        this.state = {
          ...this.state,
          allNodes: this.state.allNodes.map((n) =>
            n.id === params.assistantMessageId
              ? { ...n, content: accumulatedContent, status: "complete" }
              : n
          ),
          isGenerating: false,
          generatingAssistantId: null,
        };
        this.notify();
      } else {
        // Real stream error: preserve node as error
        this.state = {
          ...this.state,
          allNodes: this.state.allNodes.map((n) =>
            n.id === params.assistantMessageId
              ? { ...n, status: "error", error: err?.message || "Stream failed" }
              : n
          ),
          isGenerating: false,
          generatingAssistantId: null,
          error: err?.message || "Generation error",
        };
        this.notify();
      }
    } finally {
      this.abortController = null;

      // Always persist the final assistant node with whatever content was accumulated
      if (accumulatedContent.length > 0) {
        await this.transport.persistNode({
          id: params.assistantMessageId,
          sessionId: this.sessionId,
          parentId: params.userMessageId,
          role: "assistant",
          content: accumulatedContent,
        });
      }

      // Update active leaf in backend
      if (this.state.activeLeafId) {
        await this.transport.updateActiveLeaf(this.sessionId, this.state.activeLeafId);
      }
    }
  }
}
