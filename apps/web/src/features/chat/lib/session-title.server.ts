import { redis } from "@repo/redis";

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://127.0.0.1:8000";
const QUEUE_KEY = "queue:title_generation";

/**
 * Enqueues a title generation task to Redis queue (takes ~1ms).
 * If Redis is unavailable, falls back to direct async HTTP endpoint on Agent server.
 * Never blocks or delays the chat stream.
 */
export function generateSmartTitleInBackground(
  sessionId: string,
  userPrompt: string
): void {
  (async () => {
    try {
      if (!userPrompt || userPrompt.trim().length < 2) return;

      const payload = JSON.stringify({
        sessionId,
        userPrompt: userPrompt.trim(),
        createdAt: Date.now(),
      });

      // 1. Primary path: Redis Task Queue (Instant & Rate-limited worker pool)
      try {
        await redis.lpush(QUEUE_KEY, payload);
        console.log(`[SmartTitle] Enqueued title task to Redis [${QUEUE_KEY}] for session ${sessionId}`);
        return;
      } catch (redisError) {
        console.warn(`[SmartTitle] Redis enqueue failed, falling back to HTTP:`, redisError);
      }

      // 2. Fallback path: Direct HTTP to Agent server
      const response = await fetch(`${AGENT_SERVER_URL}/api/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userPrompt }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[SmartTitle] HTTP Fallback generated title: "${data?.title}"`);
      }
    } catch (error) {
      console.warn(`[SmartTitle] Background title task error:`, error);
    }
  })();
}
