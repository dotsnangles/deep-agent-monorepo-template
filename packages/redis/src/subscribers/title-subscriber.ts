import type { Redis } from "ioredis";

export const TITLE_UPDATED_CHANNEL = "events:session:title_updated";

export interface TitleUpdatedEventPayload {
  sessionId: string;
  title: string;
}

export interface SessionTitleStore {
  updateSessionTitleById(sessionId: string, title: string): Promise<boolean>;
}

export interface RedisTitleSubscriberOptions {
  redisClient: Redis;
  titleStore: SessionTitleStore;
  onTitleUpdated?: (sessionId: string, title: string) => void | Promise<void>;
}

export class RedisTitleSubscriber {
  private redis: Redis;
  private titleStore: SessionTitleStore;
  private onTitleUpdated?: (sessionId: string, title: string) => void | Promise<void>;
  private isRunning: boolean = false;
  private messageHandler: (channel: string, message: string) => void;
  private readyHandler: () => void;

  constructor(options: RedisTitleSubscriberOptions) {
    this.redis = options.redisClient;
    this.titleStore = options.titleStore;
    this.onTitleUpdated = options.onTitleUpdated;

    this.messageHandler = async (channel: string, message: string) => {
      if (channel === TITLE_UPDATED_CHANNEL) {
        await this.handleMessage(message);
      }
    };

    this.readyHandler = async () => {
      if (this.isRunning) {
        try {
          await this.redis.subscribe(TITLE_UPDATED_CHANNEL);
        } catch (err) {
          console.error("[RedisTitleSubscriber] Resubscribe on ready failed:", err);
        }
      }
    };
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.redis.on("message", this.messageHandler);
    this.redis.on("ready", this.readyHandler);

    try {
      await this.redis.subscribe(TITLE_UPDATED_CHANNEL);
    } catch (err) {
      console.error("[RedisTitleSubscriber] Initial subscribe error:", err);
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    this.redis.removeListener("message", this.messageHandler);
    this.redis.removeListener("ready", this.readyHandler);
    try {
      await this.redis.unsubscribe(TITLE_UPDATED_CHANNEL);
    } catch {
      // Graceful teardown even if connection is already closed
    }
  }

  public async handleMessage(rawMessage: string): Promise<boolean> {
    try {
      const payload = JSON.parse(rawMessage) as TitleUpdatedEventPayload;
      if (!payload?.sessionId || !payload?.title) {
        return false;
      }

      const trimmedTitle = payload.title.trim();
      if (!trimmedTitle) {
        return false;
      }

      // Persist to database via TitleStore port
      const updated = await this.titleStore.updateSessionTitleById(payload.sessionId, trimmedTitle);
      if (!updated) {
        return false;
      }

      // Invoke optional real-time callback
      if (this.onTitleUpdated) {
        await this.onTitleUpdated(payload.sessionId, trimmedTitle);
      }

      return true;
    } catch (err) {
      console.error("[RedisTitleSubscriber] Failed to process title update message:", err);
      return false;
    }
  }
}
