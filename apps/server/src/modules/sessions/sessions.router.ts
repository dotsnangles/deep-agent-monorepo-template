import { Router, type Router as ExpressRouter } from "express";
import { createChatSessionSchema } from "@repo/validators";
import { chatRepository } from "@repo/db";

export const sessionsRouter: ExpressRouter = Router();

sessionsRouter.get("/api/sessions/user/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const sessions = await chatRepository.getSessions(userId);
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

sessionsRouter.post("/api/sessions", async (req, res, next) => {
  try {
    const parsed = createChatSessionSchema.parse(req.body);
    const userId = parsed.userId || req.body.userId;
    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }
    const session = await chatRepository.createSession({
      id: parsed.id || crypto.randomUUID(),
      userId,
      title: parsed.title,
    });
    res.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});
