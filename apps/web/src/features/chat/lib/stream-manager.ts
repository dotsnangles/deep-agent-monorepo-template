import type { CreateChatMessageDTO, ChatStreamRequestDTO } from "@repo/validators";

export interface StreamMessageContext {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamState {
  sessionId: string;
  assistantMessageId: string;
  userMessageId: string | null;
  content: string;
  isGenerating: boolean;
  error?: string | null;
  titleSnippet?: string;
}

export interface StartStreamOptions {
  sessionId: string;
  assistantMessageId: string;
  userMessageId: string | null;
  contextMessages: StreamMessageContext[];
  titleSnippet?: string;
  fetchFn?: typeof fetch;
  saveMessageFn?: (msg: CreateChatMessageDTO) => Promise<any>;
}

type StreamSubscriber = (state: StreamState) => void;

async function persistMessageNode(
  msg: CreateChatMessageDTO,
  saveMessageFn?: (msg: CreateChatMessageDTO) => Promise<any>,
  fetchFn: typeof fetch = typeof window !== "undefined" ? window.fetch.bind(window) : fetch
): Promise<void> {
  try {
    if (saveMessageFn) {
      await saveMessageFn(msg);
    } else {
      await fetchFn("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
    }
  } catch (err) {
    console.error("[StreamManager] Failed to persist message node:", err);
  }
}

export class StreamManager {
  private activeStreams: Map<
    string,
    {
      state: StreamState;
      controller: AbortController;
      subscribers: Set<StreamSubscriber>;
    }
  > = new Map();

  private globalSubscribers: Set<() => void> = new Set();

  public isSessionGenerating(sessionId: string): boolean {
    const stream = this.activeStreams.get(sessionId);
    return !!stream?.state.isGenerating;
  }

  public getGeneratingSessionIds(): string[] {
    return Array.from(this.activeStreams.keys()).filter((id) =>
      this.isSessionGenerating(id)
    );
  }

  public getActiveStreamStates(): StreamState[] {
    return Array.from(this.activeStreams.values())
      .filter((s) => s.state.isGenerating)
      .map((s) => ({ ...s.state }));
  }

  public getStreamState(sessionId: string): StreamState | null {
    return this.activeStreams.get(sessionId)?.state || null;
  }

  public subscribe(sessionId: string, callback: StreamSubscriber): () => void {
    let stream = this.activeStreams.get(sessionId);
    if (!stream) {
      // Create lazy stream entry so subscribers can register before/after
      stream = {
        state: {
          sessionId,
          assistantMessageId: "",
          userMessageId: null,
          content: "",
          isGenerating: false,
        },
        controller: new AbortController(),
        subscribers: new Set(),
      };
      this.activeStreams.set(sessionId, stream);
    }

    stream.subscribers.add(callback);
    // Immediately emit current state
    callback(stream.state);

    return () => {
      stream?.subscribers.delete(callback);
      if (
        !stream?.state.isGenerating &&
        stream?.subscribers.size === 0
      ) {
        this.activeStreams.delete(sessionId);
      }
    };
  }

  public subscribeGlobal(callback: () => void): () => void {
    this.globalSubscribers.add(callback);
    return () => {
      this.globalSubscribers.delete(callback);
    };
  }

  private notifyGlobal(): void {
    this.globalSubscribers.forEach((cb) => cb());
  }

  private notifySession(sessionId: string): void {
    const stream = this.activeStreams.get(sessionId);
    if (stream) {
      const stateCopy = { ...stream.state };
      stream.subscribers.forEach((cb) => cb(stateCopy));
    }
    this.notifyGlobal();
  }

  public stopStream(sessionId: string): void {
    const stream = this.activeStreams.get(sessionId);
    if (stream && stream.state.isGenerating) {
      stream.controller.abort();
    }
  }

  public async startStream(options: StartStreamOptions): Promise<void> {
    const {
      sessionId,
      assistantMessageId,
      userMessageId,
      contextMessages,
      titleSnippet,
      fetchFn = typeof window !== "undefined" ? window.fetch.bind(window) : fetch,
      saveMessageFn,
    } = options;

    const controller = new AbortController();
    const existing = this.activeStreams.get(sessionId);
    const subscribers = existing?.subscribers || new Set();

    const streamEntry: {
      state: StreamState;
      controller: AbortController;
      subscribers: Set<StreamSubscriber>;
    } = {
      state: {
        sessionId,
        assistantMessageId,
        userMessageId,
        content: "",
        isGenerating: true,
        titleSnippet,
      },
      controller,
      subscribers,
    };

    this.activeStreams.set(sessionId, streamEntry);
    this.notifySession(sessionId);

    let accumulatedContent = "";

    try {
      const payload: ChatStreamRequestDTO = {
        threadId: sessionId,
        messages: contextMessages,
      };

      const response = await fetchFn("/api/chat/stream", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            accumulatedContent += chunk;
            streamEntry.state.content = accumulatedContent;
            this.notifySession(sessionId);
          }
        }
      } else {
        accumulatedContent = "답변 생성에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
        streamEntry.state.content = accumulatedContent;
        this.notifySession(sessionId);
      }

      const cleanContent = accumulatedContent.trim() || "답변이 준비되었습니다.";
      await persistMessageNode(
        {
          id: assistantMessageId,
          sessionId,
          parentId: userMessageId,
          role: "assistant",
          content: cleanContent,
        },
        saveMessageFn,
        fetchFn
      );
    } catch (error: any) {
      if (error.name === "AbortError" || controller.signal.aborted) {
        const finalContent = accumulatedContent.trim() || "(답변 생성이 중단되었습니다.)";
        streamEntry.state.content = finalContent;
        await persistMessageNode(
          {
            id: assistantMessageId,
            sessionId,
            parentId: userMessageId,
            role: "assistant",
            content: finalContent,
          },
          saveMessageFn,
          fetchFn
        );
      } else {
        console.error("[StreamManager] Stream error:", error);
        streamEntry.state.error = error?.message || "에러가 발생했습니다.";
        if (accumulatedContent.trim()) {
          await persistMessageNode(
            {
              id: assistantMessageId,
              sessionId,
              parentId: userMessageId,
              role: "assistant",
              content: accumulatedContent.trim(),
            },
            saveMessageFn,
            fetchFn
          );
        }
      }
    } finally {
      streamEntry.state.isGenerating = false;
      this.notifySession(sessionId);

      if (streamEntry.subscribers.size === 0) {
        this.activeStreams.delete(sessionId);
      }
    }
  }
}

// Global Singleton for Client Application
export const globalStreamManager = new StreamManager();
