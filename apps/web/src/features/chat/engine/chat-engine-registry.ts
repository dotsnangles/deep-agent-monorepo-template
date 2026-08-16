import { ChatEngine } from "./chat-engine";
import type { ChatEngineOptions } from "./chat-engine";
import type { ChatTransport } from "./transport";
import { HttpChatTransport } from "./transport";
import { DEFAULT_SESSION_TITLE } from "../lib/session-title";

export type RegistryEvent =
  | { type: "sessionCreated"; sessionId: string; payload: { title?: string } }
  | { type: "streamStarted"; sessionId: string; payload: { assistantMessageId: string | null } }
  | { type: "streamChunk"; sessionId: string; payload: { assistantMessageId: string | null; content: string } }
  | { type: "streamCompleted"; sessionId: string; payload: { assistantMessageId: string | null; content: string } }
  | { type: "streamError"; sessionId: string; payload: { error: string } }
  | { type: "titleUpdated"; sessionId: string; payload: { title: string } }
  | { type: "sessionDeleted"; sessionId: string; payload?: Record<string, never> };

export type RegistryEventType = RegistryEvent["type"];
export type RegistryListener = (event: RegistryEvent) => void;

export interface ChatEngineRegistryOptions {
  defaultTransport?: ChatTransport;
}

export class ChatEngineRegistry {
  private engines: Map<string, ChatEngine> = new Map();
  private listeners: Set<RegistryListener> = new Set();
  private defaultTransport: ChatTransport;
  private previousEngineStates: Map<
    string,
    {
      isGenerating: boolean;
      contentLength: number;
      error: string | null;
      assistantMessageId: string | null;
      lastContent: string;
      title: string;
    }
  > = new Map();

  constructor(options?: ChatEngineRegistryOptions) {
    this.defaultTransport = options?.defaultTransport || new HttpChatTransport();
  }

  public setDefaultTransport(transport: ChatTransport): void {
    this.defaultTransport = transport;
  }

  public getEngine(
    sessionId: string,
    options?: Omit<ChatEngineOptions, "sessionId">
  ): ChatEngine {
    let engine = this.engines.get(sessionId);
    if (!engine) {
      const transport = options?.transport || this.defaultTransport;
      engine = new ChatEngine({
        sessionId,
        transport,
        initialNodes: options?.initialNodes,
        initialActiveLeafId: options?.initialActiveLeafId,
        initialTitle: options?.initialTitle,
        onSessionCreated: (createdSessionId, title) => {
          if (options?.onSessionCreated) {
            options.onSessionCreated(createdSessionId, title);
          }
          this.emit({
            type: "sessionCreated",
            sessionId: createdSessionId,
            payload: { title: title || DEFAULT_SESSION_TITLE },
          });
        },
      });

      this.engines.set(sessionId, engine);
      this.attachEngineListeners(sessionId, engine);
    }
    return engine;
  }

  public hasEngine(sessionId: string): boolean {
    return this.engines.has(sessionId);
  }

  public isSessionGenerating(sessionId: string): boolean {
    const engine = this.engines.get(sessionId);
    return !!engine?.getState().isGenerating;
  }

  public getGeneratingSessionIds(): string[] {
    const generating: string[] = [];
    for (const [sessionId, engine] of this.engines.entries()) {
      if (engine.getState().isGenerating) {
        generating.push(sessionId);
      }
    }
    return generating;
  }

  public removeEngine(sessionId: string): boolean {
    const engine = this.engines.get(sessionId);
    if (!engine) return false;

    // Do not remove engine if it is actively generating in the background
    if (engine.getState().isGenerating) {
      return false;
    }

    this.engines.delete(sessionId);
    this.previousEngineStates.delete(sessionId);
    return true;
  }

  public subscribe(listener: RegistryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(event: RegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[ChatEngineRegistry] Error in registry listener:", err);
      }
    }
  }

  public notifyTitleUpdated(sessionId: string, title: string): void {
    const engine = this.engines.get(sessionId);
    if (engine) {
      engine.setTitle(title);
    } else {
      this.emit({
        type: "titleUpdated",
        sessionId,
        payload: { title },
      });
    }
  }

  public notifySessionDeleted(sessionId: string): void {
    this.emit({
      type: "sessionDeleted",
      sessionId,
    });
    this.removeEngine(sessionId);
  }

  public clear(): void {
    for (const engine of this.engines.values()) {
      engine.stop();
    }
    this.engines.clear();
    this.previousEngineStates.clear();
  }

  private attachEngineListeners(sessionId: string, engine: ChatEngine): void {
    const initialEngineState = engine.getState();
    this.previousEngineStates.set(sessionId, {
      isGenerating: initialEngineState.isGenerating,
      contentLength: 0,
      error: null,
      assistantMessageId: null,
      lastContent: "",
      title: initialEngineState.title,
    });

    engine.subscribe(() => {
      const state = engine.getState();
      const prev = this.previousEngineStates.get(sessionId) || {
        isGenerating: false,
        contentLength: 0,
        error: null,
        assistantMessageId: null,
        lastContent: "",
        title: DEFAULT_SESSION_TITLE,
      };

      const activeAssistantId = state.generatingAssistantId || prev.assistantMessageId;
      const activeAssistant = state.activePath.find((n) => n.id === activeAssistantId) ||
        state.allNodes.find((n) => n.id === activeAssistantId);
      const currentContent = activeAssistant?.content || "";
      const currentLength = currentContent.length;

      // Detect title updated
      if (state.title !== prev.title) {
        this.emit({
          type: "titleUpdated",
          sessionId,
          payload: { title: state.title },
        });
      }

      // Detect stream started
      if (!prev.isGenerating && state.isGenerating) {
        this.emit({
          type: "streamStarted",
          sessionId,
          payload: { assistantMessageId: state.generatingAssistantId },
        });
      }

      // Detect chunk received
      if (state.isGenerating && currentLength > prev.contentLength) {
        this.emit({
          type: "streamChunk",
          sessionId,
          payload: {
            assistantMessageId: activeAssistantId,
            content: currentContent,
          },
        });
      }

      // Detect stream completed
      if (prev.isGenerating && !state.isGenerating && !state.error) {
        this.emit({
          type: "streamCompleted",
          sessionId,
          payload: {
            assistantMessageId: activeAssistantId,
            content: currentContent || prev.lastContent,
          },
        });
      }

      // Detect stream error
      if (state.error && state.error !== prev.error) {
        this.emit({
          type: "streamError",
          sessionId,
          payload: { error: state.error },
        });
      }

      // Update previous state snapshot
      this.previousEngineStates.set(sessionId, {
        isGenerating: state.isGenerating,
        contentLength: currentLength,
        error: state.error,
        assistantMessageId: state.generatingAssistantId || prev.assistantMessageId,
        lastContent: currentContent || prev.lastContent,
        title: state.title,
      });
    });
  }
}

export const globalChatEngineRegistry = new ChatEngineRegistry();
