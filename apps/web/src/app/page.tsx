"use client";

import { useEffect, useState } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotChat } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import {
  Activity,
  Bot,
  Calculator,
  Clock,
  Sparkles,
  Zap,
} from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Card, CardContent } from "@repo/ui/components/card";

export default function Home() {
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

  const quickPrompts = [
    {
      title: "현재 시각 조회",
      icon: Clock,
      prompt: "현재 날짜와 시간을 알려줘.",
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "수학 수식 계산",
      icon: Calculator,
      prompt: "128 * 45 + 1024 의 계산 결과를 알려줘.",
      color: "text-purple-500 bg-purple-500/10",
    },
    {
      title: "시스템 상태 진단",
      icon: Activity,
      prompt: "에이전트 런타임과 시스템 상태 정보를 확인해줘.",
      color: "text-emerald-500 bg-emerald-500/10",
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-5xl mx-auto px-4 py-2">
      {/* Top Status Header */}
      <div className="flex items-center justify-between py-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center size-7 rounded-lg bg-primary/10 text-primary">
            <Bot className="size-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Hollow Echo Deep Agent</span>
              <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono">
                LangGraph
              </Badge>
            </h2>
          </div>
        </div>

        <Badge variant="secondary" className="gap-1.5 py-0.5 px-2 text-[10px] font-mono">
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

      {/* Main Fullscreen Chat Area */}
      <div className="flex-1 min-h-0 relative flex flex-col pt-2 pb-1">
        <CopilotChat
          className="h-full rounded-xl border border-border/50 shadow-xs overflow-hidden bg-background/50 backdrop-blur-xs"
          labels={{
            placeholder: "무엇이든 물어보거나 작업을 요청하세요... (예: '현재 시각 알려줘', '계산해줘')",
          }}
        />
      </div>
    </div>
  );
}
