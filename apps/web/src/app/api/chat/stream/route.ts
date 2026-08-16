import { NextRequest, NextResponse } from "next/server";
import { auth } from "@repo/auth";
import { env } from "@repo/env/server";
import { chatStreamRequestSchema } from "@repo/validators";
import { headers } from "next/headers";

const AGENT_SERVER_URL = env.AGENT_SERVER_URL;

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = chatStreamRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { threadId, messages, agentType, systemPrompt, resume } = parseResult.data;

    const agentRes = await fetch(`${AGENT_SERVER_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId,
        messages: messages?.map((m) => ({
          role: m.role,
          content: m.content,
          attachments: m.attachments,
        })),
        agentType,
        systemPrompt,
        resume,
      }),
    });

    if (!agentRes.ok || !agentRes.body) {
      const errorText = await agentRes.text().catch(() => "Agent server error");
      return NextResponse.json(
        { error: `Agent stream failed: ${errorText}` },
        { status: agentRes.status || 500 }
      );
    }

    return new Response(agentRes.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[API POST /api/chat/stream] Error:", error);
    return NextResponse.json(
      { error: "Failed to connect to agent stream" },
      { status: 500 }
    );
  }
}
