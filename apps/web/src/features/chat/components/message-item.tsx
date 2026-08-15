"use client";

import { useMemo, useState } from "react";
import { Bot, Check, Copy, Edit2, RotateCw, Trash2, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import {
  type MessageNode,
  getBranchInfo,
  pruneSubtree,
} from "../lib/tree";
import { MessageBranchSwitcher } from "./message-branch-switcher";

interface MessageItemProps {
  message: MessageNode;
  allNodes: MessageNode[];
  isGenerating: boolean;
  onNavigateSibling: (direction: "prev" | "next") => void;
  onEdit: (newContent: string) => void;
  onRegenerate: () => void;
  onDelete: () => void;
}

export function MessageItem({
  message,
  allNodes,
  isGenerating,
  onNavigateSibling,
  onEdit,
  onRegenerate,
  onDelete,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === "user";

  const branchInfo = useMemo(() => {
    return getBranchInfo(message.id, allNodes);
  }, [message.id, allNodes]);

  const affectedSubtreeCount = useMemo(() => {
    const { deletedIds } = pruneSubtree(allNodes, message.id);
    return deletedIds.length;
  }, [allNodes, message.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("메시지가 클립보드에 복사되었습니다.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사에 실패했습니다.");
    }
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
      className={`group relative flex w-full gap-3.5 px-4 py-3.5 rounded-2xl transition-colors duration-150 ${
        isUser
          ? "bg-transparent flex-row-reverse"
          : "bg-muted/30 border border-border/40 hover:border-border/70"
      }`}
    >
      {/* Sender Avatar */}
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-semibold shadow-2xs ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground border border-border/60"
        }`}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4 text-primary" />}
      </div>

      {/* Main Message Body & Controls */}
      <div className={`flex flex-col gap-1.5 min-w-0 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Message Sender & Timestamp Header */}
        <div className="flex items-center gap-2 px-1 text-[11px] font-medium text-muted-foreground">
          <span>{isUser ? "나" : "AI 어시스턴트"}</span>
          <span className="text-[10px] opacity-60">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Content or Inline Editor */}
        {isEditing ? (
          <div className="flex flex-col gap-2 w-full min-w-[320px] max-w-xl p-2.5 rounded-xl bg-background border border-primary/40 shadow-sm">
            <Textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              className="text-xs min-h-[80px] resize-y"
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
                <span>저장 및 분기 생성</span>
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed break-words whitespace-pre-wrap ${
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-xs shadow-xs"
                : "bg-background/80 text-foreground border border-border/50 rounded-tl-xs shadow-2xs"
            }`}
          >
            {message.content ? (
              message.content
            ) : isGenerating ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground animate-pulse">
                <span className="size-1.5 rounded-full bg-primary animate-ping" />
                답변 작성 중...
              </span>
            ) : (
              <span className="text-muted-foreground italic">(내용 없음)</span>
            )}
          </div>
        )}

        {/* Action Bar (Branch Switcher + Hover Actions) */}
        {!isEditing && (
          <div className={`flex items-center gap-1.5 pt-0.5 px-0.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
            {/* Branch Switcher (< 1/3 >) */}
            <MessageBranchSwitcher
              branchInfo={branchInfo}
              onNavigate={onNavigateSibling}
              disabled={isGenerating}
            />

            {/* Smart Hover Action Buttons */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              {/* Copy */}
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
                title="복사"
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
                  title="질문 수정 (새 분기 생성)"
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
                  title="답변 다시 생성 (새 분기 생성)"
                >
                  <RotateCw className={`size-3 ${isGenerating ? "animate-spin" : ""}`} />
                </Button>
              )}

              {/* Delete with Confirmation */}
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isGenerating}
                title="삭제"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Warning Bar */}
        {showDeleteConfirm && (
          <div className="flex items-center justify-between gap-3 mt-1.5 p-2 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
            <span className="text-[11px] font-medium">
              이 메시지와 하위 대화 <strong>{affectedSubtreeCount}개</strong>를 모두 삭제하시겠습니까?
            </span>
            <div className="flex items-center gap-1 shrink-0">
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
    </div>
  );
}
