"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  ListChecks,
  Loader2,
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
import type { TodoItem } from "../lib/types";

interface TodoPlanCardProps {
  todos: TodoItem[];
  isGenerating?: boolean;
  className?: string;
}

export function TodoPlanCard({
  todos,
  isGenerating = false,
  className = "",
}: TodoPlanCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!todos || todos.length === 0) {
    return null;
  }

  const completedCount = todos.filter((t) => t.status === "completed").length;
  const inProgressItem = todos.find((t) => t.status === "in_progress");
  const totalCount = todos.length;
  const isAllCompleted = completedCount === totalCount;

  return (
    <Card
      data-testid="todo-plan-card"
      size="sm"
      className={`mb-3 shadow-2xs ${className}`}
    >
      {/* Card Header as Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full text-left cursor-pointer"
      >
        <CardHeader className="flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks data-icon="inline-start" />
            </div>
            <CardTitle className="text-xs font-semibold text-foreground">
              작업 계획
            </CardTitle>
            <Badge variant="secondary" className="text-[11px] font-medium">
              {`${completedCount}/${totalCount} 완료`}
            </Badge>
            {isGenerating && inProgressItem && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-primary">
                <Loader2 data-icon="inline-start" className="animate-spin" />
                <span className="truncate max-w-[200px]">{inProgressItem.content}</span>
              </span>
            )}
          </div>

          <CardAction>
            <div className="flex items-center text-muted-foreground">
              {isOpen ? (
                <ChevronUp data-icon="inline-start" />
              ) : (
                <ChevronDown data-icon="inline-start" />
              )}
            </div>
          </CardAction>
        </CardHeader>
      </button>

      {/* Checklist Body */}
      {isOpen && (
        <CardContent className="space-y-2 pt-1 border-t border-border/40">
          {todos.map((todo, idx) => {
            const isCompleted = todo.status === "completed";
            const isInProgress = todo.status === "in_progress";

            return (
              <div
                key={todo.id || idx}
                data-testid={`todo-item-${idx}`}
                className={`flex items-start gap-2 text-xs transition-colors ${
                  isCompleted
                    ? "text-muted-foreground"
                    : isInProgress
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/80"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 data-icon="inline-start" className="text-primary" />
                  ) : isInProgress ? (
                    <Loader2 data-icon="inline-start" className="text-primary animate-spin" />
                  ) : (
                    <Circle data-icon="inline-start" className="text-muted-foreground/40" />
                  )}
                </div>
                <span
                  className={`leading-relaxed ${
                    isCompleted ? "line-through opacity-70" : ""
                  }`}
                >
                  {todo.content}
                </span>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
