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
  content: z.string().min(1, "content cannot be empty"),
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

export const chatStreamRequestSchema = z.object({
  threadId: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
});

export type ChatStreamRequestDTO = z.infer<typeof chatStreamRequestSchema>;
