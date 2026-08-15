import { createApp } from "./app";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});

// Graceful Shutdown
function shutdown(signal: string) {
  console.log(`\n[Server] Received ${signal}, closing server gracefully...`);
  server.close(() => {
    console.log("[Server] Closed gracefully.");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
