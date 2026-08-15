"use client";

import { useEffect, useState } from "react";
import { useCopilotChat } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import {
  Activity,
  ArrowUpRight,
  Bot,
  Calculator,
  CheckCircle2,
  Clock,
  Code2,
  Cpu,
  Layers,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Separator } from "@repo/ui/components/separator";

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
      appendMessage(
        new TextMessage({
          role: Role.User,
          content: promptText,
        })
      );
    }
  };

  const sampleActions = [
    {
      title: "현재 시각 조회",
      tool: "get_current_time",
      desc: "에이전트에게 현재 날짜 및 시각 조회를 요청합니다.",
      prompt: "현재 시간과 날짜를 알려줘.",
      icon: Clock,
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "수학 계산 도구",
      tool: "calculate",
      desc: "복잡한 수식과 산술 연산 도구를 실행합니다.",
      prompt: "15 * 24 + 180 이 얼마인지 계산해줘.",
      icon: Calculator,
      color: "text-purple-500 bg-purple-500/10",
    },
    {
      title: "시스템 정보 조회",
      tool: "query_system_info",
      desc: "에이전트가 실행 중인 시스템 환경과 상태를 진단합니다.",
      prompt: "시스템 상태 정보를 확인하고 보고해줘.",
      icon: Activity,
      color: "text-emerald-500 bg-emerald-500/10",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* SaaS Hero Banner */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 md:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1.5 py-1 px-2.5 font-medium border-primary/30 text-primary bg-primary/5">
                <Sparkles className="size-3.5" />
                <span>LangChain Deep Agent Starter</span>
              </Badge>
              <Badge
                variant="secondary"
                className="gap-1.5 py-1 px-2.5 font-mono text-[11px]"
              >
                <span
                  className={`size-2 rounded-full ${
                    loading
                      ? "bg-amber-400 animate-ping"
                      : isOnline
                      ? "bg-emerald-500 animate-pulse"
                      : "bg-destructive"
                  }`}
                />
                {loading
                  ? "Connecting..."
                  : isOnline
                  ? `Runtime Online (${health?.provider || "Ollama"})`
                  : "Runtime Offline"}
              </Badge>
            </div>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
              Deep Agent Orchestration Hub
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              LangChain <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded border">create_deep_agent</code> 및 CopilotKit AG-UI 기반의 차세대 AI 에이전트 작업 공간입니다.
              우측 사이드바 채팅을 통해 에이전트와 즉시 상호작용하거나 아래 도구 액션을 실행할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
            <Button
              onClick={() => sendQuickPrompt("안녕! 너는 어떤 일을 할 수 있는지 간략하게 소개해줘.")}
              className="gap-2 font-medium"
            >
              <Bot className="size-4" />
              <span>에이전트와 대화 시작</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Tool Execution Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <h2 className="text-sm font-semibold tracking-tight uppercase text-muted-foreground">
              에이전트 도구 빠른 실행
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">클릭 시 우측 챗봇으로 프롬프트 전송</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sampleActions.map((action) => (
            <Card
              key={action.tool}
              className="relative group cursor-pointer transition-all hover:border-primary/50 hover:shadow-sm"
              onClick={() => sendQuickPrompt(action.prompt)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${action.color}`}>
                    <action.icon className="size-4" />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <CardTitle className="text-sm font-semibold mt-2">{action.title}</CardTitle>
                <CardDescription className="text-xs">{action.desc}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                  <code className="font-mono text-primary/80">@{action.tool}</code>
                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">실행 &rarr;</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Architecture & Customization Guide */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">에이전트 아키텍처 및 확장 가이드</CardTitle>
          </div>
          <CardDescription className="text-xs">
            시스템 구성요소 및 커스텀 에이전트 확장 방법을 확인하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 text-xs">
            <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>1. 도구(Tools) 추가</span>
              </div>
              <p className="text-muted-foreground">
                <code className="text-primary font-mono">apps/agent/agent.py</code> 파일에 <code className="font-mono">@tool</code> 데코레이터 함수를 정의하여 손쉽게 확장
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>2. 시스템 프롬프트 정의</span>
              </div>
              <p className="text-muted-foreground">
                <code className="text-primary font-mono">MAIN_SYSTEM_PROMPT</code> 변수를 통해 에이전트의 페르소나 및 행동 규칙을 커스텀
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>3. 멀티 에이전트 분기</span>
              </div>
              <p className="text-muted-foreground">
                <code className="text-primary font-mono">SUBAGENTS</code> 리스트에 특화된 서브에이전트를 등록하여 복합 작업 위임
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>4. LLM 프로바이더 전환</span>
              </div>
              <p className="text-muted-foreground">
                <code className="text-primary font-mono">.env</code> 파일의 <code className="font-mono">LLM_PROVIDER</code> 설정으로 Ollama, OpenAI, Claude 전환 가능
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
