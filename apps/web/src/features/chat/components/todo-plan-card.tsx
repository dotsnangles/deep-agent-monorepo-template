"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  ListChecks,
  Loader2,
} from "lucide-react";
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
    <div
      data-testid="todo-plan-card"
      className={`rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xs overflow-hidden transition-all duration-200 shadow-2xs mb-3 ${className}`}
    >
      {/* Card Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ListChecks className="size-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground tracking-tight">
            작업 계획
          </span>
          <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {`${completedCount}/${totalCount} 완료`}
          </span>
          {isGenerating && inProgressItem && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-primary animate-pulse">
              <Loader2 className="size-3 animate-spin" />
              <span className="truncate max-w-[200px]">{inProgressItem.content}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          {isOpen ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </div>
      </button>

      {/* Checklist Body */}
      {isOpen && (
        <div className="px-3.5 py-2.5 space-y-2 border-t border-border/40 bg-background/40">
          {todos.map((todo, idx) => {
            const isCompleted = todo.status === "completed";
            const isInProgress = todo.status === "in_progress";

            return (
              <div
                key={todo.id || idx}
                data-testid={`todo-item-${idx}`}
                className={`flex items-start gap-2.5 text-xs transition-colors ${
                  isCompleted
                    ? "text-muted-foreground"
                    : isInProgress
                    ? "text-foreground font-medium"
                    : "text-muted-foreground/80"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                  ) : isInProgress ? (
                    <Loader2 className="size-3.5 text-primary animate-spin" />
                  ) : (
                    <Circle className="size-3.5 text-muted-foreground/40" />
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
        </div>
      )}
    </div>
  );
}
