"use client";

import { Check, ShieldAlert, X, Terminal, Wrench } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "@repo/ui/components/card";
import type { ToolApprovalRequest } from "../lib/types";

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
    <Card
      data-testid="tool-action-card"
      size="sm"
      className="my-3 w-full max-w-lg border-amber-500/30 bg-amber-500/5 shadow-2xs"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <ShieldAlert className="size-4 shrink-0" />
          <span>도구 실행 승인 요청</span>
        </CardTitle>
        <CardDescription className="flex items-center gap-1.5 font-mono text-[11px]">
          <Wrench className="size-3 text-primary/70" />
          <span className="font-semibold text-foreground">{approval.tool}</span>
          {approval.description && <span>— {approval.description}</span>}
        </CardDescription>
        <CardAction>
          {isApproved && (
            <Badge
              data-testid="badge-approved"
              variant="secondary"
              className="gap-1 text-[11px] font-medium"
            >
              <Check data-icon="inline-start" />
              <span>승인됨</span>
            </Badge>
          )}

          {isRejected && (
            <Badge
              data-testid="badge-rejected"
              variant="destructive"
              className="gap-1 text-[11px] font-medium"
            >
              <X data-icon="inline-start" />
              <span>거부됨</span>
            </Badge>
          )}

          {isPending && (
            <Badge
              data-testid="badge-pending"
              variant="outline"
              className="text-[10px] font-medium border-amber-500/30 text-amber-600 dark:text-amber-400"
            >
              대기 중
            </Badge>
          )}
        </CardAction>
      </CardHeader>

      {/* Input Parameters Content */}
      {formattedInput && formattedInput !== "{}" && (
        <CardContent>
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
        </CardContent>
      )}

      {/* Action Footer for Pending State */}
      {isPending && (
        <CardFooter className="justify-end gap-2 pt-2">
          <Button
            data-testid="tool-reject-button"
            variant="outline"
            size="sm"
            className="h-7 px-3 text-xs gap-1 cursor-pointer"
            onClick={() => onReject(DEFAULT_REJECTION_REASON)}
            disabled={isGenerating}
          >
            <X data-icon="inline-start" />
            <span>거절</span>
          </Button>

          <Button
            data-testid="tool-approve-button"
            size="sm"
            className="h-7 px-3.5 text-xs gap-1 cursor-pointer"
            onClick={onApprove}
            disabled={isGenerating}
          >
            <Check data-icon="inline-start" />
            <span>승인</span>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
