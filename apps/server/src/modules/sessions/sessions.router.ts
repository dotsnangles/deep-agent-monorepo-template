import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";
import * as sessionsService from "./sessions.service";

export const sessionsRouter: ExpressRouter = Router();

const CreateSessionSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  title: z.string().optional(),
});

sessionsRouter.get("/api/sessions/user/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const sessions = await sessionsService.getUserSessions(userId);
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.post("/api/sessions", async (req, res, next) => {
  try {
    const { userId, title } = CreateSessionSchema.parse(req.body);
    const session = await sessionsService.createSession(userId, title);
    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});
