import cors from "cors";
import express, { type Express } from "express";
import { corsConfig } from "./config/cors";
import { errorHandler } from "./middlewares/error-handler";
import { authRouter } from "./modules/auth";
import { healthRouter } from "./modules/health";
import { sessionsRouter } from "./modules/sessions";
import { storageRouter } from "./modules/storage";

export function createApp(): Express {
  const app = express();

  // Global Middlewares
  app.use(cors(corsConfig));

  // Better-Auth handler (needs raw stream/body for some auth endpoints)
  app.use(authRouter);

  // JSON parser for application routes
  app.use(express.json());

  // Application Domain Routes
  app.use(healthRouter);
  app.use(sessionsRouter);
  app.use(storageRouter);

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
