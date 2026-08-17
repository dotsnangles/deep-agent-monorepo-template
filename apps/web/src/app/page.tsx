"use client";

import { useEffect, useState } from "react";
import { Bot, GitFork, Layers } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  MessageFeed,
  useChatSessions,
  useChatEngine,
  ArtifactSidebar,
} from "@/features/chat";

export default function Home() {
  const { activeSessionId } = useChatSessions();
  const { artifacts } = useChatEngine(activeSessionId);
  const [isArtifactsOpen, setIsArtifactsOpen] = useState(false);
  const [health, setHealth] = useState<{
    status?: string;
    provider?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/copilotkit/health");
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        } else {
          setHealth({ status: "healthy", provider: "Ollama / DeepAgent" });
        }
      } catch {
        setHealth({ status: "offline" });
      } finally {
        setLoading(false);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = health?.status === "healthy" || health?.status === "ok" || !loading;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Status Header */}
      <div className="shrink-0 w-full border-b border-border/40 px-3 sm:px-6 pt-3 sm:pt-4 pb-2">
        <div className="flex items-center justify-between max-w-4xl mx-auto py-1">
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

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setIsArtifactsOpen(true)}
              title="대화 산출물 보기"
            >
              <Layers className="size-3.5" data-icon="inline-start" />
              <span className="hidden sm:inline">산출물</span>
              {artifacts.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-mono leading-none">
                  {artifacts.length}
                </Badge>
              )}
            </Button>

            <Badge variant="secondary" className="gap-1.5 py-1 px-2.5 text-[10px] font-mono bg-muted/60">
              <span
                className={`size-1.5 rounded-full ${
                  loading
                    ? "bg-amber-400 animate-ping"
                    : isOnline
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-destructive"
                }`}
              />
              <span>{loading ? "연결 중..." : isOnline ? "에이전트 준비됨" : "오프라인"}</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Fullscreen Message Feed */}
      <div className="flex-1 min-h-0 relative flex flex-col w-full overflow-hidden">
        <MessageFeed key={activeSessionId} sessionId={activeSessionId} />
      </div>

      {/* Right Artifacts Drawer */}
      <ArtifactSidebar
        sessionId={activeSessionId}
        artifacts={artifacts}
        isOpen={isArtifactsOpen}
        onOpenChange={setIsArtifactsOpen}
      />
    </div>
  );
}
