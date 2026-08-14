"use client";

import { useEffect, useState } from "react";
import { useCopilotChat } from "@copilotkit/react-core";
import {
  Activity,
  Calculator,
  Clock,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

export default function Home() {
  const [health, setHealth] = useState<{
    status?: string;
    provider?: string;
    agents?: Record<string, unknown>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { appendMessage } = useCopilotChat();

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/copilotkit/health");
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        } else {
          // Fallback to runtime info endpoint
          const resFallback = await fetch("/api/copilotkit");
          if (resFallback.ok) {
            const dataFallback = await resFallback.json();
            setHealth({ status: "healthy", ...dataFallback });
          } else {
            setHealth({ status: "error" });
          }
        }
      } catch {
        setHealth({ status: "offline" });
      } finally {
        setLoading(false);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const isOnline =
    health?.status === "healthy" ||
    health?.status === "ok" ||
    health?.agents !== undefined;

  const sendQuickPrompt = (promptText: string) => {
    if (appendMessage) {
      appendMessage({
        id: Date.now().toString(),
        content: promptText,
        role: "user",
      } as any);
    }
  };

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8 space-y-8">
      {/* Header Banner */}
      <section className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>LangChain Deep Agent Starter</span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                loading
                  ? "bg-amber-400 animate-ping"
                  : isOnline
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-destructive"
              }`}
            />
            <span className="text-muted-foreground">
              {loading
                ? "Connecting..."
                : isOnline
                ? `Backend Active (${health?.provider || "Ollama"})`
                : "Backend Offline"}
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Custom Deep Agent Starter Kit
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          LangChain <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">create_deep_agent</code> 및 CopilotKit AG-UI 기반의 커스텀 딥에이전트 기본 템플릿입니다.
          오른쪽 사이드바(CopilotSidebar)를 통해 커스텀 도구 및 에이전트 동작을 바로 테스트할 수 있습니다.
        </p>
      </section>

      {/* Quick Test Actions */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          <h2 className="text-base font-bold tracking-tight">Sample Tool Actions</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <button
            onClick={() => sendQuickPrompt("현재 시간과 날짜를 알려줘.")}
            className="flex flex-col justify-between rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="space-y-2">
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500 w-fit">
                <Clock className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-sm">현재 시각 조회</h3>
              <p className="text-xs text-muted-foreground">
                <code className="font-mono text-[10px]">get_current_time</code> 도구 테스트
              </p>
            </div>
            <span className="mt-3 text-xs font-medium text-primary">&rarr; 실행</span>
          </button>

          <button
            onClick={() => sendQuickPrompt("15 * 24 + 180 이 얼마인지 계산해줘.")}
            className="flex flex-col justify-between rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="space-y-2">
              <div className="rounded-lg bg-purple-500/10 p-2 text-purple-500 w-fit">
                <Calculator className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-sm">수학 계산 도구</h3>
              <p className="text-xs text-muted-foreground">
                <code className="font-mono text-[10px]">calculate</code> 도구 테스트
              </p>
            </div>
            <span className="mt-3 text-xs font-medium text-primary">&rarr; 실행</span>
          </button>

          <button
            onClick={() => sendQuickPrompt("시스템 상태 정보를 확인하고 보고해줘.")}
            className="flex flex-col justify-between rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm"
          >
            <div className="space-y-2">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500 w-fit">
                <Activity className="h-4 w-4" />
              </div>
              <h3 className="font-semibold text-sm">시스템 정보 조회</h3>
              <p className="text-xs text-muted-foreground">
                <code className="font-mono text-[10px]">query_system_info</code> 도구 테스트
              </p>
            </div>
            <span className="mt-3 text-xs font-medium text-primary">&rarr; 실행</span>
          </button>
        </div>
      </section>

      {/* Developer Guide */}
      <section className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <Terminal className="h-4 w-4 text-primary" />
          <span>에이전트 커스터마이징 안내</span>
        </div>
        <div className="text-xs text-muted-foreground space-y-2 leading-relaxed font-mono bg-muted/50 p-4 rounded-lg">
          <p>1. 도구 추가: <code className="text-primary">apps/agent/agent.py</code> 내 <code className="text-primary">@tool</code> 데코레이터로 자유롭게 추가</p>
          <p>2. 프롬프트 수정: <code className="text-primary">MAIN_SYSTEM_PROMPT</code> 변수에서 역할 및 가이드라인 정의</p>
          <p>3. 서브에이전트 추가: <code className="text-primary">SUBAGENTS</code> 리스트에 전문화된 하위 에이전트 등록</p>
          <p>4. LLM 변경: <code className="text-primary">.env</code>의 <code className="text-primary">LLM_PROVIDER</code> (ollama / openai / anthropic / google)</p>
        </div>
      </section>
    </main>
  );
}
