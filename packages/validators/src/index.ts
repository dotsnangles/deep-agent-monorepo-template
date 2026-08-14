import { z } from "zod";

// Base response schema for API
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
  });

// Example Health Check validator
export const healthCheckSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  timestamp: z.string().datetime().or(z.string()),
});

export type HealthCheck = z.infer<typeof healthCheckSchema>;
