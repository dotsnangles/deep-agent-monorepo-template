import { getPresignedDownloadUrl, getPresignedUploadUrl } from "@repo/storage";
import { Router, type Router as ExpressRouter } from "express";
import { z } from "zod";

export const storageRouter: ExpressRouter = Router();

const PresignedUrlSchema = z.object({
  key: z.string().min(1, "Key must not be empty"),
  expiresInSeconds: z.number().int().positive().optional(),
});

storageRouter.post("/api/storage/upload-url", async (req, res, next) => {
  try {
    const { key, expiresInSeconds } = PresignedUrlSchema.parse(req.body);
    const uploadUrl = await getPresignedUploadUrl(key, expiresInSeconds);
    res.json({ uploadUrl, key });
  } catch (error) {
    next(error);
  }
});

storageRouter.post("/api/storage/download-url", async (req, res, next) => {
  try {
    const { key, expiresInSeconds } = PresignedUrlSchema.parse(req.body);
    const downloadUrl = await getPresignedDownloadUrl(key, expiresInSeconds);
    res.json({ downloadUrl, key });
  } catch (error) {
    next(error);
  }
});
