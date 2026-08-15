import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: "../../apps/server/.env",
});

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  tablesFilter: [
    "user",
    "account",
    "session",
    "verification",
    "chat_session",
    "chat_message",
  ],
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
