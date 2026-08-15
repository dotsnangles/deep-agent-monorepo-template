import { env } from "@repo/env/server";
import type { CorsOptions } from "cors";

export const corsConfig: CorsOptions = {
  origin: env.CORS_ORIGIN,
  methods: ["GET", "POST", "OPTIONS", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
