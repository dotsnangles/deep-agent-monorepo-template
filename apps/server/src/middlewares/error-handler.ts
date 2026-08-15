import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation Failed",
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof Error) {
    console.error(`[Error] ${err.message}`, err.stack);
    res.status(500).json({
      error: err.message || "Internal Server Error",
    });
    return;
  }

  console.error("[Unhandled Exception]", err);
  res.status(500).json({
    error: "Internal Server Error",
  });
}
