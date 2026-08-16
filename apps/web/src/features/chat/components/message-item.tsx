"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Bot, Check, Copy, Edit2, RotateCw, Trash2, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import type { MessageNode, BranchInfo } from "../lib/tree";
import { MessageBranchSwitcher } from "./message-branch-switcher";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolActionCard } from "./tool-action-card";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard";

interface MessageItemProps {
  message: MessageNode;
  branchInfo: BranchInfo;
  affectedSubtreeCount?: number;
  isGenerating: boolean;
  onNavigateSibling: (direction: "prev" | "next") => void;
  onEdit: (newContent: string) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onRetry?: () => void;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string, reason?: string) => void;
}

export function MessageItem({
  message,
  branchInfo,
  affectedSubtreeCount = 1,
  isGenerating,
  onNavigateSibling,
  onEdit,
  onRegenerate,
  onDelete,
  onRetry,
  onApprove,
  onReject,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { copied, copy } = useCopyToClipboard("메시지가 클립보드에 복사되었습니다.");

  const isUser = message.role === "user";

  const handleCopy = () => {
    copy(message.content);
  };

  const handleSaveEdit = () => {
    if (!editDraft.trim() || editDraft.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    onEdit(editDraft.trim());
    setIsEditing(false);
  };

  return (
    <div
      className={`group relative flex w-full gap-3 py-2 px-1 transition-colors duration-150 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* AI Bot Avatar (Shown on left for assistant messages) */}
      {!isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs mt-0.5">
          <Bot className="size-4" />
        </div>
      )}

      {/* Main Message Content Column */}
      <div
        className={`flex flex-col min-w-0 ${
          isUser
            ? "items-end max-w-[85%] sm:max-w-[78%]"
            : "items-start max-w-[92%] sm:max-w-[88%] w-full"
        }`}
      >
        {/* Header: Sender Label & Time */}
        <div
          className={`flex items-center gap-2 mb-1 px-1 text-[11px] font-medium text-muted-foreground ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          <span>{isUser ? "나" : "Hollow Echo Agent"}</span>
          <span className="text-[10px] opacity-60">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Content Body: User bubble vs AI canvas markdown */}
        {isEditing ? (
          <div className="flex flex-col gap-2 w-full min-w-[320px] max-w-xl p-3 rounded-2xl bg-background border border-primary/40 shadow-sm">
            <Textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              className="text-sm min-h-[90px] resize-y leading-relaxed"
              autoFocus
            />
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => {
                  setEditDraft(message.content);
                  setIsEditing(false);
                }}
              >
                <X className="size-3 mr-1" />
                취소
              </Button>
              <Button
                size="sm"
                className="h-7 px-3 text-xs gap-1"
                onClick={handleSaveEdit}
                disabled={isGenerating || !editDraft.trim()}
              >
                <Check className="size-3" />
                <span>저장 및 새 분기 생성</span>
              </Button>
            </div>
          </div>
        ) : isUser ? (
          /* User Message: Clean rounded bubble */
          <div className="rounded-2xl rounded-tr-xs bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-xs break-words whitespace-pre-wrap">
            {message.content}
          </div>
        ) : (
          /* Assistant Message: Clean stream layout with Markdown & Tool Action Card */
          <div className="w-full text-sm leading-relaxed text-foreground py-0.5 space-y-2">
            {message.content ? (
              <MarkdownRenderer content={message.content} isGenerating={isGenerating} />
            ) : isGenerating && !message.toolApproval ? (
              <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                <span className="animate-pulse">답변을 생성하고 있습니다...</span>
              </div>
            ) : message.status === "error" || message.error ? null : message.toolApproval ? null : (
              <span className="text-muted-foreground italic text-xs">(내용 없음)</span>
            )}

            {/* Inline Interactive Tool Action Card */}
            {message.toolApproval && (
              <ToolActionCard
                approval={message.toolApproval}
                isGenerating={isGenerating}
                onApprove={() => onApprove?.(message.toolApproval!.toolCallId)}
                onReject={(reason) => onReject?.(message.toolApproval!.toolCallId, reason)}
              />
            )}

            {/* Error Message & Retry Banner */}
            {(message.status === "error" || message.error) && (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive w-full max-w-md animate-in fade-in-50 duration-150">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="size-4 shrink-0" />
                  <span className="truncate">{message.error || "답변 생성 중 오류가 발생했습니다."}</span>
                </div>
                {onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2.5 text-[11px] border-destructive/40 hover:bg-destructive/20 text-destructive gap-1 shrink-0 cursor-pointer"
                    onClick={onRetry}
                    disabled={isGenerating}
                  >
                    <RotateCw className="size-3" />
                    <span>재시도</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Bar (Branch Switcher + Quick Actions) */}
        {!isEditing && (
          <div
            className={`flex items-center gap-2 mt-1 px-1 ${
              isUser ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Branch Switcher (< 1/3 >) */}
            <MessageBranchSwitcher
              branchInfo={branchInfo}
              onNavigate={onNavigateSibling}
              disabled={isGenerating}
            />

            {/* Smart Action Buttons */}
            <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity duration-150">
              {/* Copy */}
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
                title="메시지 복사"
              >
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
              </Button>

              {/* Edit (User Only) */}
              {isUser && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsEditing(true)}
                  disabled={isGenerating}
                  title="질문 수정 (새 대화 분기 생성)"
                >
                  <Edit2 className="size-3" />
                </Button>
              )}

              {/* Regenerate (Assistant Only) */}
              {!isUser && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={onRegenerate}
                  disabled={isGenerating}
                  title="답변 다시 생성 (새 대화 분기 생성)"
                >
                  <RotateCw className={`size-3 ${isGenerating ? "animate-spin" : ""}`} />
                </Button>
              )}

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isGenerating}
                title="메시지 삭제"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Alert Banner */}
        {showDeleteConfirm && (
          <div className="flex items-center justify-between gap-3 mt-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive w-full max-w-md animate-in fade-in-50 duration-150">
            <span className="text-[11px] font-medium">
              이 메시지와 하위 대화 <strong>{affectedSubtreeCount}개</strong>를 삭제하시겠습니까?
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px]"
                onClick={() => setShowDeleteConfirm(false)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-6 px-2.5 text-[11px]"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete();
                }}
              >
                삭제 확인
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* User Avatar (Shown on right for user messages) */}
      {isUser && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-2xs mt-0.5">
          <User className="size-4" />
        </div>
      )}
    </div>
  );
}
