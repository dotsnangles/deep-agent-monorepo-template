"use client";

import { Check, ShieldAlert, X, Terminal, Wrench } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import type { ToolApprovalRequest } from "../lib/tree";

export const DEFAULT_REJECTION_REASON = "사용자에 의해 거절되었습니다.";

export interface ToolActionCardProps {
  approval: ToolApprovalRequest;
  isGenerating?: boolean;
  onApprove: () => void;
  onReject: (reason?: string) => void;
}

export function ToolActionCard({
  approval,
  isGenerating = false,
  onApprove,
  onReject,
}: ToolActionCardProps) {
  const isPending = approval.status === "pending";
  const isApproved = approval.status === "approved";
  const isRejected = approval.status === "rejected";

  const formattedInput =
    typeof approval.input === "object"
      ? JSON.stringify(approval.input, null, 2)
      : String(approval.input);

  return (
    <div
      data-testid="tool-action-card"
      className="my-3 flex flex-col gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-foreground shadow-2xs w-full max-w-lg transition-all duration-150 animate-in fade-in-50"
    >
      {/* Header with Tool Name & Status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
          <ShieldAlert className="size-4 shrink-0" />
          <span>도구 실행 승인 요청</span>
        </div>

        {isApproved && (
          <span
            data-testid="badge-approved"
            className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
          >
            <Check className="size-3" />
            <span>승인됨</span>
          </span>
        )}

        {isRejected && (
          <span
            data-testid="badge-rejected"
            className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive border border-destructive/20"
          >
            <X className="size-3" />
            <span>거부됨</span>
          </span>
        )}

        {isPending && (
          <span
            data-testid="badge-pending"
            className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20"
          >
            대기 중
          </span>
        )}
      </div>

      {/* Tool Details & Description */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <Wrench className="size-3 text-primary/70" />
          <span className="font-semibold text-foreground">{approval.tool}</span>
        </div>
        {approval.description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {approval.description}
          </p>
        )}
      </div>

      {/* Input Parameters Box */}
      {formattedInput && formattedInput !== "{}" && (
        <div className="rounded-lg bg-background/80 border border-border/60 p-2 font-mono text-[11px] leading-relaxed overflow-x-auto text-foreground">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
            <Terminal className="size-3" />
            <span>인자 (Arguments)</span>
          </div>
          <pre
            data-testid="tool-parameters-pre"
            className="whitespace-pre-wrap break-all text-xs font-mono"
          >
            {formattedInput}
          </pre>
        </div>
      )}

      {/* Action Buttons for Pending State */}
      {isPending && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            data-testid="tool-reject-button"
            variant="outline"
            size="sm"
            className="h-7 px-3 text-xs gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            onClick={() => onReject(DEFAULT_REJECTION_REASON)}
            disabled={isGenerating}
          >
            <X className="size-3" />
            <span>거절</span>
          </Button>

          <Button
            data-testid="tool-approve-button"
            size="sm"
            className="h-7 px-3.5 text-xs gap-1 cursor-pointer"
            onClick={onApprove}
            disabled={isGenerating}
          >
            <Check className="size-3" />
            <span>승인</span>
          </Button>
        </div>
      )}
    </div>
  );
}
