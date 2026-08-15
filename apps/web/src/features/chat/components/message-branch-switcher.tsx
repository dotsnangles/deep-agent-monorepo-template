"use client";

import { ChevronLeft, ChevronRight, GitBranch } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { type BranchInfo } from "../lib/tree";

interface MessageBranchSwitcherProps {
  branchInfo: BranchInfo;
  onNavigate: (direction: "prev" | "next") => void;
  disabled?: boolean;
}

export function MessageBranchSwitcher({
  branchInfo,
  onNavigate,
  disabled = false,
}: MessageBranchSwitcherProps) {
  if (branchInfo.totalBranches <= 1) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/80 border border-border/60 text-[11px] font-mono text-muted-foreground select-none shadow-2xs">
      <GitBranch className="size-3 text-primary shrink-0 opacity-70" />
      <Button
        variant="ghost"
        size="icon"
        className="size-5 rounded-xs hover:bg-background/80 hover:text-foreground disabled:opacity-30"
        onClick={() => onNavigate("prev")}
        disabled={disabled}
        title="이전 분기 (Shift+Left)"
      >
        <ChevronLeft className="size-3" />
      </Button>

      <span className="px-0.5 font-medium text-foreground tracking-tight">
        {branchInfo.currentIndex}
        <span className="text-muted-foreground/60 mx-0.5">/</span>
        {branchInfo.totalBranches}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="size-5 rounded-xs hover:bg-background/80 hover:text-foreground disabled:opacity-30"
        onClick={() => onNavigate("next")}
        disabled={disabled}
        title="다음 분기 (Shift+Right)"
      >
        <ChevronRight className="size-3" />
      </Button>
    </div>
  );
}
