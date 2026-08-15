import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { auth } from "@repo/auth";
import { db, chatSession } from "@repo/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { generateSmartTitleInBackground } from "@/features/chat/server";

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://127.0.0.1:8000";

const serviceAdapter = new ExperimentalEmptyAdapter();

const runtime = new CopilotRuntime({
  agents: {
    default: new LangGraphHttpAgent({
      url: `${AGENT_SERVER_URL}/copilotkit`,
    }),
  },
});

function findUserMessage(obj: any): string | null {
  if (!obj) return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findUserMessage(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof obj === "object") {
    const role = String(obj.role || obj.type || "").toLowerCase();
    const content = obj.content || obj.text || obj.message;

    if (
      (role.includes("user") || role.includes("text") || (!role && typeof content === "string")) &&
      typeof content === "string" &&
      content.trim().length > 0
    ) {
      const clean = content.trim().replace(/[\r\n\t]+/g, " ");
      return clean.length > 30 ? clean.slice(0, 30) + "..." : clean;
    }

    for (const key of Object.keys(obj)) {
      if (key === "schema" || key === "tools" || key === "extensions") continue;
      const found = findUserMessage(obj[key]);
      if (found) return found;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const authSession = await auth.api.getSession({
      headers: reqHeaders,
    });

    const threadId =
      req.headers.get("x-copilotkit-thread-id") ||
      req.nextUrl.searchParams.get("threadId");

    if (authSession?.user?.id && threadId) {
      const existing = await db
        .select()
        .from(chatSession)
        .where(eq(chatSession.id, threadId))
        .limit(1);

      // Check if this request actually contains a user message (Write vs Read)
      let userMessageTitle: string | null = null;
      try {
        const bodyClone = await req.clone().json();
        userMessageTitle = findUserMessage(bodyClone);
      } catch {
        // Ignore unparseable payload
      }

      if (existing.length > 0) {
        // Ownership security check
        if (existing[0].userId !== authSession.user.id) {
          return NextResponse.json(
            { error: "Forbidden: You do not have access to this chat session." },
            { status: 403 }
          );
        }

        // ONLY update timestamp when a new message is actively sent by the user!
        // Simple clicks / read-only thread loads will NOT bump the session to top.
        if (userMessageTitle) {
          await db
            .update(chatSession)
            .set({ updatedAt: new Date() })
            .where(eq(chatSession.id, threadId));
        }
      } else {
        // ONLY create session record when user actually sends a non-empty message!
        if (userMessageTitle && userMessageTitle.trim().length > 0) {
          await db
            .insert(chatSession)
            .values({
              id: threadId,
              userId: authSession.user.id,
              title: userMessageTitle,
            })
            .onConflictDoNothing();

          // Generate a concise smart title asynchronously in the background!
          generateSmartTitleInBackground(threadId, userMessageTitle);
        }
      }
    }

    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime,
      serviceAdapter,
      endpoint: "/api/copilotkit",
    });

    return await handleRequest(req);
  } catch (error) {
    console.error("[POST /api/copilotkit] Error:", error);
    return NextResponse.json(
      { error: "Failed to process agent request" },
      { status: 500 }
    );
  }
}
