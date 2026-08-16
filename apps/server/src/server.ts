import { createApp } from "./app";
import { redis, RedisTitleSubscriber } from "@repo/redis";
import { drizzleChatRepository } from "@repo/db";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = createApp();

export const titleSubscriber = new RedisTitleSubscriber({
  redisClient: redis,
  titleStore: drizzleChatRepository,
});

titleSubscriber.start().catch((err) => {
  console.error("[Server] Failed to start RedisTitleSubscriber:", err);
});

const server = app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});

// Graceful Shutdown
async function shutdown(signal: string) {
  console.log(`\n[Server] Received ${signal}, closing server gracefully...`);
  await titleSubscriber.stop();
  server.close(() => {
    console.log("[Server] Closed gracefully.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
