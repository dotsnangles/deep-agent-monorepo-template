import type {
  CreateChatMessageDTO,
  ResumeActionDTO,
  AttachmentEntity,
  ChatArtifactEntity,
} from "@repo/validators";
import {
  findNewActiveLeafAfterPrune,
  findDeepestDescendant,
  getBranchInfo,
  pruneSubtree,
  traverseActivePath,
  type BranchInfo,
  type MessageNode,
  type ToolApprovalRequest,
  type TodoItem,
  type SubagentExecution,
  type ToolCallExecution,
} from "../lib/tree";
import { deriveSessionTitle } from "../lib/session-title";
import {
  HttpChatTransport,
  type ChatTransport,
  type StreamMessageContext,
} from "./transport";
import { StreamReasoningPartitioner } from "../lib/stream-partitioner";

export interface ChatEngineState {
  sessionId: string;
  allNodes: MessageNode[];
  activeLeafId: string | null;
  activePath: MessageNode[];
  artifacts: (ChatArtifactEntity & { url?: string; downloadUrl?: string })[];
  isLoading: boolean;
  isGenerating: boolean;
  generatingAssistantId: string | null;
  error: string | null;
  title: string;
}

export interface ChatEngineOptions {
  sessionId: string;
  transport?: ChatTransport;
  initialNodes?: MessageNode[];
  initialActiveLeafId?: string | null;
  initialTitle?: string;
  initialArtifacts?: (ChatArtifactEntity & { url?: string; downloadUrl?: string })[];
  onSessionCreated?: (sessionId: string, title: string) => void;
}

function generateNodeId(prefix: "user" | "asst" | "sys"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class ChatEngine {
  public readonly sessionId: string;
  private transport: ChatTransport;
  private state: ChatEngineState;
  private listeners = new Set<() => void>();
  private abortController: AbortController | null = null;
  private onSessionCreated?: (sessionId: string, title: string) => void;
  private isSending = false;

  constructor(options: ChatEngineOptions) {
    this.sessionId = options.sessionId;
    this.transport = options.transport || new HttpChatTransport();
    this.onSessionCreated = options.onSessionCreated;

    const initialNodes = options.initialNodes || [];
    const initialActiveLeafId =
      options.initialActiveLeafId !== undefined ? options.initialActiveLeafId : null;

    this.state = {
      sessionId: options.sessionId,
      allNodes: initialNodes,
      activeLeafId: initialActiveLeafId,
      activePath:
        initialNodes.length > 0
          ? traverseActivePath(initialNodes, initialActiveLeafId)
          : [],
      artifacts: options.initialArtifacts || [],
      isLoading: !options.initialNodes,
      isGenerating: false,
      generatingAssistantId: null,
      error: null,
      title: options.initialTitle || "새로운 대화",
    };
  }

  public getState(): ChatEngineState {
    return this.state;
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public isCurrentlyGenerating(): boolean {
    return this.state.isGenerating;
  }

  public setTitle(title: string): void {
    if (this.state.title !== title) {
      this.state = {
        ...this.state,
        title,
      };
      this.notify();
    }
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
      .map((n) => ({
        role: n.role,
        content: n.content,
        attachments: n.attachments,
      }));
  }

  public async loadMessages(): Promise<void> {
    if (!this.sessionId) return;
    this.state = { ...this.state, isLoading: true, error: null };
    this.notify();

    try {
      const result = await this.transport.fetchTree(this.sessionId);
      const sessionArtifacts = result.artifacts || [];
      const artifactMap = new Map<string, ChatArtifactEntity & { url?: string; downloadUrl?: string }>();
      for (const art of sessionArtifacts) {
        artifactMap.set(art.id, art);
      }
      for (const node of result.messages) {
        if (node.artifacts) {
          for (const art of node.artifacts) {
            artifactMap.set(art.id, art);
          }
        }
      }

      this.state = {
        ...this.state,
        allNodes: result.messages,
        activeLeafId: result.activeLeafId,
        title: result.title || this.state.title,
        artifacts: Array.from(artifactMap.values()),
        isLoading: false,
      };
      this.notify();
    } catch (err: any) {
      console.error(`[ChatEngine] Failed to load messages for session ${this.sessionId}:`, err);
      this.state = {
        ...this.state,
        isLoading: false,
        error: err?.message || "Failed to load chat history",
      };
      this.notify();
    }
  }

  public async loadTree(): Promise<void> {
    return this.loadMessages();
  }

  public async deleteMessage(messageId: string): Promise<void> {
    return this.deleteNode(messageId);
  }

  public async send(
    content: string,
    attachments?: AttachmentEntity[],
    titleSnippet?: string
  ): Promise<void> {
    if ((!content.trim() && (!attachments || attachments.length === 0)) || this.isSending) return;
    this.isSending = true;

    const isInitialMessage = this.state.allNodes.length === 0;
    let derivedTitle = this.state.title;

    if (isInitialMessage) {
      derivedTitle = titleSnippet || deriveSessionTitle(content || attachments?.[0]?.name || "새로운 대화");
    }

    const userMessageId = generateNodeId("user");
    const assistantMessageId = generateNodeId("asst");
    const parentId = this.state.activeLeafId;

    const userNode: MessageNode = {
      id: userMessageId,
      sessionId: this.sessionId,
      parentId,
      role: "user",
      content: content.trim(),
      attachments: attachments ? [...attachments] : [],
      createdAt: new Date(),
      status: "complete",
    };

    const assistantNode: MessageNode = {
      id: assistantMessageId,
      sessionId: this.sessionId,
      parentId: userMessageId,
      role: "assistant",
      content: "",
      attachments: [],
      createdAt: new Date(),
      status: "streaming",
    };

    // Optimistically append user and empty assistant node + derived title on initial send
    this.state = {
      ...this.state,
      title: isInitialMessage ? derivedTitle : this.state.title,
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
      attachments: userNode.attachments,
    });

    // Notify session created only on initial send
    if (isInitialMessage && this.onSessionCreated) {
      this.onSessionCreated(this.sessionId, derivedTitle);
    }

    const contextMessages = this.buildContextMessages(assistantMessageId, assistantMessageId);

    await this.executeStream({
      assistantMessageId,
      userMessageId,
      contextMessages,
    });

    this.isSending = false;
  }

  public async respondToApproval(
    toolCallId: string,
    approved: boolean,
    reason?: string
  ): Promise<void> {
    if (this.isSending) return;

    // Find the assistant node containing this approval request
    const targetNode = this.state.allNodes.find(
      (n) => n.toolApproval?.toolCallId === toolCallId
    );
    if (!targetNode) return;

    this.isSending = true;

    // Update approval status optimistically
    const updatedApproval: ToolApprovalRequest = {
      ...targetNode.toolApproval!,
      status: approved ? "approved" : "rejected",
      reason,
    };

    this.state = {
      ...this.state,
      allNodes: this.state.allNodes.map((n) =>
        n.id === targetNode.id
          ? { ...n, toolApproval: updatedApproval, status: "streaming" }
          : n
      ),
      isGenerating: true,
      generatingAssistantId: targetNode.id,
      error: null,
    };
    this.notify();

    const contextMessages = this.buildContextMessages(targetNode.id, targetNode.id);
    const resumePayload: ResumeActionDTO = {
      toolCallId,
      approved,
      reason,
    };

    await this.executeStream({
      assistantMessageId: targetNode.id,
      userMessageId: targetNode.parentId,
      contextMessages,
      resume: resumePayload,
    });

    this.isSending = false;
  }

  public async forkAndEdit(
    targetNodeId: string,
    newContent: string,
    attachments?: AttachmentEntity[]
  ): Promise<void> {
    if (this.isSending) return;
    this.isSending = true;

    const targetNode = this.state.allNodes.find((n) => n.id === targetNodeId);
    if (!targetNode || targetNode.role !== "user") {
      this.isSending = false;
      return;
    }

    const newUserNodeId = generateNodeId("user");
    const newAssistantNodeId = generateNodeId("asst");
    const inheritedAttachments =
      attachments !== undefined
        ? attachments
        : targetNode.attachments
        ? [...targetNode.attachments]
        : [];

    const newUserNode: MessageNode = {
      id: newUserNodeId,
      sessionId: this.sessionId,
      parentId: targetNode.parentId, // sibling of targetNode
      role: "user",
      content: newContent.trim(),
      attachments: inheritedAttachments,
      createdAt: new Date(),
      status: "complete",
    };

    const newAssistantNode: MessageNode = {
      id: newAssistantNodeId,
      sessionId: this.sessionId,
      parentId: newUserNodeId,
      role: "assistant",
      content: "",
      attachments: [],
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
      attachments: newUserNode.attachments,
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
      attachments: [],
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

  public async retry(failedNodeId?: string): Promise<void> {
    if (this.isSending) return;

    let targetNode: MessageNode | undefined;
    if (failedNodeId) {
      targetNode = this.state.allNodes.find((n) => n.id === failedNodeId);
    } else {
      targetNode = this.state.activePath[this.state.activePath.length - 1];
    }

    if (!targetNode || targetNode.role !== "assistant") return;

    this.isSending = true;

    // Reset status of failed node
    this.state = {
      ...this.state,
      allNodes: this.state.allNodes.map((n) =>
        n.id === targetNode.id ? { ...n, status: "streaming", error: null, content: "" } : n
      ),
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
  }

  public async selectBranch(nodeId: string, direction: "prev" | "next"): Promise<void> {
    const targetNode = this.state.allNodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    const siblings = this.state.allNodes.filter(
      (n) => n.sessionId === targetNode.sessionId && n.parentId === targetNode.parentId
    );

    siblings.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const currentIndex = siblings.findIndex((n) => n.id === nodeId);
    if (currentIndex === -1) return;

    const nextIndex =
      direction === "prev"
        ? Math.max(0, currentIndex - 1)
        : Math.min(siblings.length - 1, currentIndex + 1);

    if (nextIndex === currentIndex) return;

    const targetSibling = siblings[nextIndex];
    // Find the latest active leaf descending from targetSibling
    const newLeafId = this.findDeepestDescendantFrom(targetSibling.id);

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

  public async forkSession(
    fromMessageId: string,
    title?: string
  ): Promise<{ newSessionId: string; title: string } | null> {
    if (this.state.isGenerating) {
      return null;
    }

    const res = await this.transport.forkSession(this.sessionId, fromMessageId, title);
    if (!res) {
      return null;
    }

    this.onSessionCreated?.(res.session.id, res.session.title);

    return {
      newSessionId: res.session.id,
      title: res.session.title,
    };
  }

  private async executeStream(params: {
    assistantMessageId: string;
    userMessageId: string | null;
    contextMessages: StreamMessageContext[];
    resume?: ResumeActionDTO;
  }): Promise<void> {
    this.abortController = new AbortController();
    const existingNode = this.state.allNodes.find((n) => n.id === params.assistantMessageId);
    const partitioner = new StreamReasoningPartitioner(
      existingNode?.content || "",
      existingNode?.reasoning,
      existingNode?.reasoningDuration
    );
    let capturedApproval: ToolApprovalRequest | null = existingNode?.toolApproval || null;
    let capturedTodos: TodoItem[] = existingNode?.todos ? [...existingNode.todos] : [];
    let capturedSubagents: SubagentExecution[] = existingNode?.subagents ? [...existingNode.subagents] : [];
    let capturedToolCalls: ToolCallExecution[] = existingNode?.toolCalls ? [...existingNode.toolCalls] : [];
    let capturedArtifacts: (ChatArtifactEntity & { url: string })[] = existingNode?.artifacts
      ? [...(existingNode.artifacts as (ChatArtifactEntity & { url: string })[])]
      : [];
    let capturedAttachments: AttachmentEntity[] = existingNode?.attachments
      ? [...existingNode.attachments]
      : [];

    try {
      await this.transport.streamResponse(
        {
          sessionId: this.sessionId,
          assistantMessageId: params.assistantMessageId,
          userMessageId: params.userMessageId,
          contextMessages: params.contextMessages,
          resume: params.resume,
        },
        {
          onToken: (chunk) => {
            partitioner.feedToken(chunk);
            const pState = partitioner.getState();
            this.state = {
              ...this.state,
              allNodes: this.state.allNodes.map((n) =>
                n.id === params.assistantMessageId
                  ? {
                      ...n,
                      content: pState.content,
                      reasoning: pState.reasoning,
                      reasoningDuration: pState.reasoningDuration,
                      isThinking: pState.isThinking,
                      status: "streaming",
                    }
                  : n
              ),
            };
            this.notify();
          },
          onReasoningChunk: (chunk) => {
            partitioner.feedReasoning(chunk);
            const pState = partitioner.getState();
            this.state = {
              ...this.state,
              allNodes: this.state.allNodes.map((n) =>
                n.id === params.assistantMessageId
                  ? {
                      ...n,
                      content: pState.content,
                      reasoning: pState.reasoning,
                      reasoningDuration: pState.reasoningDuration,
                      isThinking: pState.isThinking,
                      status: "streaming",
                    }
                  : n
              ),
            };
            this.notify();
          },
          onApprovalRequest: (approval) => {
            capturedApproval = approval;
            this.state = {
              ...this.state,
              allNodes: this.state.allNodes.map((n) =>
                n.id === params.assistantMessageId
                  ? { ...n, toolApproval: approval }
                  : n
              ),
            };
            this.notify();
          },
          onTodoUpdate: (todos) => {
            capturedTodos = todos;
            this.state = {
              ...this.state,
              allNodes: this.state.allNodes.map((n) =>
                n.id === params.assistantMessageId
                  ? { ...n, todos: capturedTodos }
                  : n
              ),
            };
            this.notify();
          },
          onSubagentStart: (subagent, task, runId) => {
            const existingIdx = capturedSubagents.findIndex(
              (s) => (runId && s.runId === runId) || (s.subagent === subagent && s.status === "running")
            );
            const newEntry: SubagentExecution = {
              subagent,
              task,
              status: "running",
              runId,
            };
            if (existingIdx >= 0) {
              capturedSubagents[existingIdx] = newEntry;
            } else {
              capturedSubagents.push(newEntry);
            }
            this.state = {
              ...this.state,
              allNodes: this.state.allNodes.map((n) =>
                n.id === params.assistantMessageId
                  ? { ...n, subagents: [...capturedSubagents] }
                  : n
              ),
            };
            this.notify();
          },
          onSubagentEnd: (subagent, output, runId) => {
            const existingIdx = capturedSubagents.findIndex(
              (s) => (runId && s.runId === runId) || (s.subagent === subagent && s.status === "running")
            );
            if (existingIdx >= 0) {
              capturedSubagents[existingIdx] = {
                ...capturedSubagents[existingIdx],
                status: "completed",
                output,
              };
            } else {
              capturedSubagents.push({
                subagent,
                task: "",
                status: "completed",
                output,
                runId,
              });
            }
            this.state = {
              ...this.state,
              allNodes: this.state.allNodes.map((n) =>
                n.id === params.assistantMessageId
                  ? { ...n, subagents: [...capturedSubagents] }
                  : n
              ),
            };
            this.notify();
          },
          onToolStart: (tool, input, runId) => {
            capturedToolCalls.push({ tool, input, status: "running", runId });
            this.state = {
              ...this.state,
              allNodes: this.state.allNodes.map((n) =>
                n.id === params.assistantMessageId
                  ? { ...n, toolCalls: [...capturedToolCalls] }
                  : n
              ),
            };
            this.notify();
          },
          onToolEnd: (tool, output, runId) => {
            const idx = capturedToolCalls.findIndex(
              (t) => (runId && t.runId === runId) || (t.tool === tool && t.status === "running")
            );
            if (idx >= 0) {
              capturedToolCalls[idx] = {
                ...capturedToolCalls[idx],
                status: "completed",
                output,
              };
            }
            this.state = {
              ...this.state,
              allNodes: this.state.allNodes.map((n) =>
                n.id === params.assistantMessageId
                  ? { ...n, toolCalls: [...capturedToolCalls] }
                  : n
              ),
            };
            this.notify();
          },
          onArtifactCreated: (artifact) => {
            const existingArtIdx = capturedArtifacts.findIndex((a) => a.id === artifact.id);
            if (existingArtIdx >= 0) {
              capturedArtifacts[existingArtIdx] = artifact;
            } else {
              capturedArtifacts.push(artifact);
            }

            const currentArtifacts = [...(this.state.artifacts || [])];
            const existingSessionArtIdx = currentArtifacts.findIndex((a) => a.id === artifact.id);
            if (existingSessionArtIdx >= 0) {
              currentArtifacts[existingSessionArtIdx] = artifact;
            } else {
              currentArtifacts.push(artifact);
            }

            this.state = {
              ...this.state,
              artifacts: currentArtifacts,
              allNodes: this.state.allNodes.map((n) =>
                n.id === params.assistantMessageId
                  ? {
                      ...n,
                      artifacts: [...capturedArtifacts],
                    }
                  : n
              ),
            };
            this.notify();
          },
          onDone: (finishReason) => {
            // Stream complete or interrupted
          },
          onError: (errMsg) => {
            throw new Error(errMsg);
          },
        },
        this.abortController.signal
      );

      // Successfully finished stream
      const finalPState = partitioner.getState();
      this.state = {
        ...this.state,
        allNodes: this.state.allNodes.map((n) =>
          n.id === params.assistantMessageId
            ? {
                ...n,
                content: finalPState.content,
                reasoning: finalPState.reasoning,
                reasoningDuration: finalPState.reasoningDuration,
                isThinking: false,
                status: "complete",
                toolApproval: capturedApproval,
                todos: capturedTodos.length > 0 ? capturedTodos : undefined,
                subagents: capturedSubagents.length > 0 ? capturedSubagents : undefined,
                toolCalls: capturedToolCalls.length > 0 ? capturedToolCalls : undefined,
                attachments: capturedAttachments.length > 0 ? capturedAttachments : undefined,
                artifacts: capturedArtifacts.length > 0 ? capturedArtifacts : undefined,
              }
            : n
        ),
        isGenerating: false,
        generatingAssistantId: null,
      };
      this.notify();
    } catch (err: any) {
      const isAborted = this.abortController.signal.aborted || err?.name === "AbortError";
      if (isAborted) {
        // User aborted: if no tokens received yet, remove empty ghost node and restore activeLeaf
        const currentPState = partitioner.getState();
        if (currentPState.content.length === 0 && !currentPState.reasoning) {
          this.state = {
            ...this.state,
            allNodes: this.state.allNodes.filter((n) => n.id !== params.assistantMessageId),
            activeLeafId: params.userMessageId || this.state.activeLeafId,
            isGenerating: false,
            generatingAssistantId: null,
          };
        } else {
          this.state = {
            ...this.state,
            allNodes: this.state.allNodes.map((n) =>
              n.id === params.assistantMessageId
                ? {
                    ...n,
                    content: currentPState.content,
                    reasoning: currentPState.reasoning,
                    reasoningDuration: currentPState.reasoningDuration,
                    status: "complete",
                    toolApproval: capturedApproval,
                    todos: capturedTodos.length > 0 ? capturedTodos : undefined,
                    subagents: capturedSubagents.length > 0 ? capturedSubagents : undefined,
                    toolCalls: capturedToolCalls.length > 0 ? capturedToolCalls : undefined,
                    attachments: capturedAttachments.length > 0 ? capturedAttachments : undefined,
                    artifacts: capturedArtifacts.length > 0 ? capturedArtifacts : undefined,
                  }
                : n
            ),
            isGenerating: false,
            generatingAssistantId: null,
          };
        }
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
      const savedPState = partitioner.getState();
      if (savedPState.content.length > 0 || savedPState.reasoning) {
        await this.transport.persistNode({
          id: params.assistantMessageId,
          sessionId: this.sessionId,
          parentId: params.userMessageId,
          role: "assistant",
          content: savedPState.content,
          artifacts: capturedArtifacts.length > 0 ? capturedArtifacts : undefined,
        });
      }

      // Update active leaf in backend
      if (this.state.activeLeafId) {
        await this.transport.updateActiveLeaf(this.sessionId, this.state.activeLeafId);
      }
    }
  }

  private findDeepestDescendantFrom(rootId: string): string {
    return findDeepestDescendant(this.state.allNodes, rootId);
  }
}
