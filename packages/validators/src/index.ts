import { z } from "zod";

// Base response schema for API
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
  });

// Health Check validator
export const healthCheckSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  timestamp: z.string().datetime().or(z.string()),
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;

// Storage & Attachment Constants & Schemas
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
] as const;

export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_ATTACHMENTS_PER_MESSAGE = 5;

export const attachmentEntitySchema = z.object({
  id: z.string(),
  url: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  s3Key: z.string(),
});

export type AttachmentEntity = z.infer<typeof attachmentEntitySchema>;

export const presignedUploadRequestSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES, {
    message: "Unsupported file type",
  }),
  sizeBytes: z.number().positive().max(MAX_ATTACHMENT_SIZE_BYTES, "File exceeds 20MB limit"),
  sessionId: z.string().optional(),
});

export type PresignedUploadRequestDTO = z.infer<typeof presignedUploadRequestSchema>;

export const presignedUploadResponseSchema = z.object({
  id: z.string(),
  uploadUrl: z.string(),
  downloadUrl: z.string(),
  key: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  expiresInSeconds: z.number(),
});

export type PresignedUploadResponseDTO = z.infer<typeof presignedUploadResponseSchema>;

// Chat Session DTO Schemas
export const createChatSessionSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  userId: z.string().optional(),
});

export type CreateChatSessionDTO = z.infer<typeof createChatSessionSchema>;

export const patchChatSessionSchema = z.object({
  title: z.string().min(1, "Title cannot be empty"),
});

export type PatchChatSessionDTO = z.infer<typeof patchChatSessionSchema>;

// Chat Message Tree DTO Schemas
export const createChatMessageSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  parentId: z.string().nullable().optional(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  attachments: z.array(attachmentEntitySchema).optional(),
  id: z.string().optional(),
});

export type CreateChatMessageDTO = z.infer<typeof createChatMessageSchema>;

export const patchChatLeafSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  activeLeafId: z.string().min(1, "activeLeafId is required"),
});

export type PatchChatLeafDTO = z.infer<typeof patchChatLeafSchema>;

export const deleteChatMessageSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  messageId: z.string().min(1, "messageId is required"),
});

export type DeleteChatMessageDTO = z.infer<typeof deleteChatMessageSchema>;

export const resumeActionSchema = z.object({
  toolCallId: z.string().optional(),
  approved: z.boolean(),
  reason: z.string().optional(),
});

export type ResumeActionDTO = z.infer<typeof resumeActionSchema>;

export const streamMessageContextSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  attachments: z.array(attachmentEntitySchema).optional(),
});

export type StreamMessageContextDTO = z.infer<typeof streamMessageContextSchema>;

export const chatStreamRequestSchema = z.object({
  threadId: z.string().optional(),
  messages: z.array(streamMessageContextSchema).optional().default([]),
  agentType: z.string().optional(),
  systemPrompt: z.string().optional(),
  resume: resumeActionSchema.optional(),
});

export type ChatStreamRequestDTO = z.infer<typeof chatStreamRequestSchema>;
