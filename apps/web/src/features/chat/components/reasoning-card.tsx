"use client";

import { useState } from "react";
import { Brain, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@repo/ui/components/card";

export interface ReasoningCardProps {
  reasoning?: string;
  duration?: number;
  isThinking?: boolean;
  isGenerating?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export function ReasoningCard({
  reasoning,
  duration,
  isThinking,
  isGenerating = false,
  defaultOpen = false,
  className,
}: ReasoningCardProps) {
  // Collapsed by default; user can expand on demand
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const activeThinking = isThinking !== undefined ? isThinking : isGenerating;

  if (!reasoning || !reasoning.trim()) {
    return null;
  }

  const formatDuration = (sec?: number): string => {
    if (sec === undefined || sec === null) return "생각 과정";
    if (sec < 0.5) return "< 1초 동안 생각함";
    return `${sec.toFixed(1)}초 동안 생각함`;
  };

  const sections = reasoning.split(/\n\n---\n\n/);

  return (
    <Card
      data-testid="reasoning-card"
      size="sm"
      className={cn(
        "mb-2.5 bg-muted/20 border-border/60 transition-colors shadow-2xs",
        activeThinking && "border-primary/30",
        className
      )}
    >
      {/* Clickable Header for Accordion Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full text-left cursor-pointer"
        aria-expanded={isOpen}
      >
        <CardHeader className="flex-row items-center justify-between py-2 px-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                "flex size-5 items-center justify-center rounded-md text-muted-foreground",
                activeThinking ? "bg-primary/10 text-primary animate-pulse" : "bg-muted text-muted-foreground"
              )}
            >
              {activeThinking ? (
                <Loader2 className="size-3 animate-spin text-primary" />
              ) : (
                <Brain className="size-3" />
              )}
            </div>

            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              {activeThinking ? (
                <span className="text-foreground font-semibold flex items-center gap-1">
                  생각하는 중...
                </span>
              ) : (
                <span>사고 과정</span>
              )}
            </CardTitle>

            {!activeThinking && duration !== undefined && duration !== null && (
              <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5 h-4.5 text-muted-foreground">
                <Sparkles className="size-2.5 mr-1 text-primary/70" />
                {formatDuration(duration)}
              </Badge>
            )}
          </div>

          <CardAction>
            <div className="flex items-center text-muted-foreground/70 hover:text-foreground">
              {isOpen ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </div>
          </CardAction>
        </CardHeader>
      </button>

      {/* Accordion Content Body */}
      {isOpen && (
        <CardContent className="pt-0 pb-3 px-3.5">
          <div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap rounded-md bg-background/50 p-2.5 border border-border/40 font-mono text-[11px] max-h-80 overflow-y-auto">
            {sections.length > 1 ? (
              <div className="space-y-3">
                {sections.map((section, idx) => (
                  <div
                    key={idx}
                    className={cn(idx > 0 && "pt-2.5 border-t border-border/40")}
                  >
                    {section.trim()}
                  </div>
                ))}
              </div>
            ) : (
              reasoning
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
