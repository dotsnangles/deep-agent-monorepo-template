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
} from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@repo/ui/components/card";
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
      };
    case "chart_generator":
    case "visualizer":
      return {
        label: "시각화 / 차트 생성기",
        icon: LineChart,
      };
    case "researcher":
    case "research":
      return {
        label: "연구 / 조사 전문가",
        icon: Search,
      };
    case "coder":
    case "developer":
      return {
        label: "코드 작성기",
        icon: FileCode,
      };
    default:
      return {
        label: name || "하위 에이전트",
        icon: Bot,
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
          <Card
            key={agent.runId || `${agent.subagent}-${idx}`}
            data-testid={`specialist-card-${idx}`}
            size="sm"
            className="shadow-2xs"
          >
            {/* Header as Toggle */}
            <button
              type="button"
              onClick={() => toggleExpand(idx)}
              className="w-full text-left cursor-pointer"
            >
              <CardHeader className="flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon data-icon="inline-start" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CardTitle className="text-xs font-semibold text-foreground">
                      {meta.label}
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      위임 작업
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-1">
                    {isRunning ? (
                      <Badge variant="secondary" className="gap-1 text-[10px] font-medium">
                        <Loader2 data-icon="inline-start" className="animate-spin" />
                        <span>실행 중</span>
                      </Badge>
                    ) : isCompleted ? (
                      <Badge variant="outline" className="gap-1 text-[10px] font-medium">
                        <CheckCircle2 data-icon="inline-start" className="text-primary" />
                        <span>완료</span>
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1 text-[10px] font-medium">
                        <span>오류</span>
                      </Badge>
                    )}
                  </div>
                </div>

                <CardAction>
                  <div className="text-muted-foreground">
                    {isExpanded ? (
                      <ChevronUp data-icon="inline-start" />
                    ) : (
                      <ChevronDown data-icon="inline-start" />
                    )}
                  </div>
                </CardAction>
              </CardHeader>
            </button>

            {/* Content Details */}
            {isExpanded && (
              <CardContent className="space-y-2 pt-1 border-t border-border/40 text-xs">
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
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
