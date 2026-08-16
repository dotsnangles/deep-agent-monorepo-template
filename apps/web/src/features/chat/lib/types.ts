import type { AttachmentEntity } from "@repo/validators";

export interface ToolApprovalRequest {
  toolCallId: string;
  tool: string;
  input: Record<string, any> | any;
  description?: string;
  status: "pending" | "approved" | "rejected";
  reason?: string;
}

export interface TodoItem {
  id?: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface SubagentExecution {
  subagent: string;
  task: string;
  status: "running" | "completed" | "error";
  output?: any;
  runId?: string;
}

export interface ToolCallExecution {
  tool: string;
  input: any;
  output?: any;
  status: "running" | "completed" | "error";
  runId?: string;
}

export interface MessageNode {
  id: string;
  sessionId: string;
  parentId: string | null;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: AttachmentEntity[];
  createdAt: Date | string;
  status?: "sending" | "streaming" | "complete" | "error";
  error?: string | null;
  toolApproval?: ToolApprovalRequest | null;
  todos?: TodoItem[];
  subagents?: SubagentExecution[];
  toolCalls?: ToolCallExecution[];
  reasoning?: string;
  reasoningDuration?: number;
  isThinking?: boolean;
}
