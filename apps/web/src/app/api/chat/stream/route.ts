import { NextRequest, NextResponse } from "next/server";
import { auth } from "@repo/auth";
import { headers } from "next/headers";

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { threadId, messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const agentRes = await fetch(`${AGENT_SERVER_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thread_id: threadId,
        messages: messages.map((m: any) => ({
          role: m.role || "user",
          content: m.content || "",
        })),
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
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Transfer-Encoding": "chunked",
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
