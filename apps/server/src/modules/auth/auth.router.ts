import { auth } from "@repo/auth";
import { toNodeHandler } from "better-auth/node";
import { Router, type Router as ExpressRouter } from "express";

export const authRouter: ExpressRouter = Router();

// Better-Auth catch-all handler for /api/auth/*
authRouter.all("/api/auth{/*path}", toNodeHandler(auth));
