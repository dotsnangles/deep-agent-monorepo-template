"use client";

import { useState } from "react";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCode,
  LineChart,
  Loader2,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import type { SubagentExecution } from "../lib/types";

interface SpecialistDelegationCardProps {
  subagents: SubagentExecution[];
  className?: string;
}

function getSpecialistMeta(name: string) {
  switch (name.toLowerCase()) {
    case "data_analyst":
    case "analyst":
      return {
        label: "데이터 분석가",
        icon: BarChart3,
        accent: "text-blue-500 bg-blue-500/10 border-blue-500/20",
      };
    case "chart_generator":
    case "visualizer":
      return {
        label: "시각화 / 차트 생성기",
        icon: LineChart,
        accent: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
      };
    case "researcher":
    case "research":
      return {
        label: "연구 / 조사 전문가",
        icon: Search,
        accent: "text-amber-500 bg-amber-500/10 border-amber-500/20",
      };
    case "coder":
    case "developer":
      return {
        label: "코드 작성기",
        icon: FileCode,
        accent: "text-purple-500 bg-purple-500/10 border-purple-500/20",
      };
    default:
      return {
        label: name || "하위 에이전트",
        icon: Bot,
        accent: "text-primary bg-primary/10 border-primary/20",
      };
  }
}

export function SpecialistDelegationCard({
  subagents,
  className = "",
}: SpecialistDelegationCardProps) {
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});

  if (!subagents || subagents.length === 0) {
    return null;
  }

  const toggleExpand = (idx: number) => {
    setExpandedIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div
      data-testid="specialist-delegation-card"
      className={`space-y-2 mb-3 ${className}`}
    >
      {subagents.map((agent, idx) => {
        const meta = getSpecialistMeta(agent.subagent);
        const Icon = meta.icon;
        const isRunning = agent.status === "running";
        const isCompleted = agent.status === "completed";
        const isExpanded = expandedIndices[idx] ?? true;

        return (
          <div
            key={agent.runId || `${agent.subagent}-${idx}`}
            data-testid={`specialist-card-${idx}`}
            className={`rounded-2xl border bg-card/60 backdrop-blur-xs overflow-hidden transition-all duration-200 shadow-2xs ${
              isRunning
                ? "border-primary/40 ring-1 ring-primary/20 animate-pulse"
                : "border-border/70"
            }`}
          >
            {/* Header */}
            <button
              type="button"
              onClick={() => toggleExpand(idx)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex size-6 items-center justify-center rounded-lg border ${meta.accent}`}
                >
                  <Icon className="size-3.5" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    위임 작업
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {isRunning ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                      <Loader2 className="size-2.5 animate-spin" />
                      실행 중
                    </span>
                  ) : isCompleted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-2.5" />
                      완료
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
                      오류
                    </span>
                  )}
                </div>
              </div>

              <div className="text-muted-foreground">
                {isExpanded ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </div>
            </button>

            {/* Content Details */}
            {isExpanded && (
              <div className="px-3.5 py-2.5 space-y-2 border-t border-border/40 bg-background/40 text-xs">
                {agent.task && (
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                      요청 과업
                    </span>
                    <p className="text-foreground leading-relaxed bg-muted/40 p-2 rounded-xl">
                      {agent.task}
                    </p>
                  </div>
                )}

                {agent.output && (
                  <div>
                    <span className="text-[11px] font-medium text-muted-foreground block mb-0.5">
                      수행 결과
                    </span>
                    <div className="text-muted-foreground font-mono text-[11px] bg-muted/50 p-2 rounded-xl overflow-x-auto max-h-40 whitespace-pre-wrap">
                      {typeof agent.output === "string"
                        ? agent.output
                        : JSON.stringify(agent.output, null, 2)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
