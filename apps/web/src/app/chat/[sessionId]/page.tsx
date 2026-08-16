"use client";

import { use, useEffect } from "react";
import { Bot, GitFork } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { MessageFeed, useChatSessions } from "@/features/chat";

export default function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { switchSession, activeSessionId } = useChatSessions();

  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      switchSession(sessionId);
    }
  }, [sessionId, activeSessionId, switchSession]);

  return (
    <div className="flex flex-col h-full max-w-4xl w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-4 pb-2">
      {/* Top Status Header */}
      <div className="flex items-center justify-between py-1 pb-2 shrink-0 border-b border-border/40 mb-1">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-7 rounded-lg bg-primary/10 text-primary shadow-xs">
            <Bot className="size-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Hollow Echo Deep Agent</span>
              <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-mono leading-none gap-1">
                <GitFork className="size-2.5 text-primary" />
                Linear Session
              </Badge>
            </h2>
          </div>
        </div>

        <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 text-[10px] font-mono bg-muted/60">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>에이전트 준비됨</span>
        </Badge>
      </div>

      {/* Main Fullscreen Message Feed */}
      <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
        <MessageFeed key={sessionId} sessionId={sessionId} />
      </div>
    </div>
  );
}
