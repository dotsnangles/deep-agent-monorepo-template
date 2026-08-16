/**
 * Next.js 16 Instrumentation Hook
 * Runs once when the server instance starts up.
 * Use for OpenTelemetry, error tracking, or server lifecycle initialization.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Node.js server initialization
    console.log("[Instrumentation] Web Server initialized (Next.js 16 NodeJS Runtime).");
    try {
      const { redis, RedisTitleSubscriber } = await import("@repo/redis");
      const { drizzleChatRepository } = await import("@repo/db");
      const subscriber = new RedisTitleSubscriber({
        redisClient: redis,
        titleStore: drizzleChatRepository,
      });
      await subscriber.start();
      console.log("[Instrumentation] RedisTitleSubscriber started successfully.");
    } catch (err) {
      console.warn("[Instrumentation] Failed to start RedisTitleSubscriber:", err);
    }
  }
}
