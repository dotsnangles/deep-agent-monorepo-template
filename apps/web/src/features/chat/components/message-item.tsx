"use client";

import { useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  Copy,
  Download,
  Edit2,
  GitFork,
  RotateCw,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from "@repo/ui/components/message";
import { Bubble, BubbleContent } from "@repo/ui/components/bubble";
import {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentAction,
} from "@repo/ui/components/attachment";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import type { AttachmentEntity } from "@repo/validators";
import type { MessageNode } from "../lib/types";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolActionCard } from "./tool-action-card";
import { TodoPlanCard } from "./todo-plan-card";
import { SpecialistDelegationCard } from "./specialist-delegation-card";
import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard";
import {
  formatFileSize,
  isImageMime,
  getAttachmentFileIcon,
} from "../hooks/use-direct-upload";

interface MessageItemProps {
  message: MessageNode;
  isGenerating: boolean;
  onEdit?: (newContent: string) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onRetry?: () => void;
  onFork?: () => void;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string, reason?: string) => void;
}

function MessageAttachmentsView({
  attachments,
  isUser,
}: {
  attachments: AttachmentEntity[];
  isUser: boolean;
}) {
  const [lightboxImage, setLightboxImage] = useState<AttachmentEntity | null>(null);

  const images = attachments.filter((a) => isImageMime(a.mimeType));
  const docs = attachments.filter((a) => !isImageMime(a.mimeType));

  return (
    <div className={`flex flex-col gap-2 w-full mt-1 ${isUser ? "items-end" : "items-start"}`}>
      {/* Images Grid */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxImage(img)}
              className="group relative size-20 sm:size-24 rounded-xl overflow-hidden border border-border/70 bg-muted/40 cursor-pointer shadow-xs hover:border-primary/60 transition-all"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name}
                className="size-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {/* Documents Group using shadcn Attachment Primitives */}
      {docs.length > 0 && (
        <AttachmentGroup className="max-w-full">
          {docs.map((doc) => {
            const Icon = getAttachmentFileIcon(doc.mimeType);
            return (
              <Attachment key={doc.id} size="sm">
                <AttachmentMedia variant="icon">
                  <Icon />
                </AttachmentMedia>
                <AttachmentContent>
                  <AttachmentTitle>{doc.name}</AttachmentTitle>
                  <AttachmentDescription>{formatFileSize(doc.size)}</AttachmentDescription>
                </AttachmentContent>
                <AttachmentAction
                  render={
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={doc.name}
                      title={`${doc.name} 다운로드`}
                    >
                      <Download data-icon="inline-start" />
                    </a>
                  }
                />
              </Attachment>
            );
          })}
        </AttachmentGroup>
      )}

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
              <a
                href={lightboxImage.url}
                target="_blank"
                rel="noopener noreferrer"
                download={lightboxImage.name}
                className="flex items-center justify-center size-8 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
                title="원본 다운로드"
              >
                <Download className="size-4" />
              </a>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="flex items-center justify-center size-8 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors cursor-pointer"
                title="닫기"
              >
                <X className="size-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <span className="text-xs text-white/80 mt-2 font-medium">{lightboxImage.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function MessageItem({
  message,
  isGenerating,
  onEdit,
  onRegenerate,
  onDelete,
  onRetry,
  onFork,
  onApprove,
  onReject,
}: MessageItemProps) {
  const isUser = message.role === "user";
  const { copied, copy } = useCopyToClipboard();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasAttachments = message.attachments && message.attachments.length > 0;

  const handleCopy = () => {
    copy(message.content);
  };

  const handleSaveEdit = () => {
    if (!editDraft.trim() || editDraft.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    onEdit?.(editDraft.trim());
    setIsEditing(false);
  };

  return (
    <Message align={isUser ? "end" : "start"} className="group/message py-2 px-1">
      {/* AI Bot Avatar (Shown on left for assistant messages) */}
      {!isUser && (
        <MessageAvatar className="size-8 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs mt-0.5">
          <Bot className="size-4" />
        </MessageAvatar>
      )}

      {/* Main Message Content Column */}
      <MessageContent className="min-w-0">
        {/* Header: Sender Label & Time */}
        <MessageHeader className="gap-2 mb-1 text-[11px] font-medium text-muted-foreground">
          <span>{isUser ? "나" : "Hollow Echo Agent"}</span>
          <span className="text-[10px] opacity-60">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </MessageHeader>

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
                <X data-icon="inline-start" />
                취소
              </Button>
              <Button
                size="sm"
                className="h-7 px-3 text-xs gap-1"
                onClick={handleSaveEdit}
                disabled={isGenerating || !editDraft.trim()}
              >
                <Check data-icon="inline-start" />
                <span>저장 및 새 분기 생성</span>
              </Button>
            </div>
          </div>
        ) : isUser ? (
          /* User Message: Clean shadcn Bubble with attachments */
          <div className="flex flex-col items-end gap-1.5">
            {hasAttachments && (
              <MessageAttachmentsView attachments={message.attachments!} isUser={true} />
            )}
            {message.content && (
              <Bubble variant="default" align="end">
                <BubbleContent className="rounded-2xl rounded-tr-xs text-sm leading-relaxed px-4 py-2.5 break-words whitespace-pre-wrap">
                  {message.content}
                </BubbleContent>
              </Bubble>
            )}
          </div>
        ) : (
          /* Assistant Message: Clean stream layout with Markdown, Tool Action Card, Todo Plan & Attachments */
          <div className="w-full text-sm leading-relaxed text-foreground py-0.5 space-y-2">
            {/* Live Deep Agents Todo Plan Card */}
            {message.todos && message.todos.length > 0 && (
              <TodoPlanCard todos={message.todos} isGenerating={isGenerating} />
            )}

            {/* Live Specialist Worker Delegations */}
            {message.subagents && message.subagents.length > 0 && (
              <SpecialistDelegationCard subagents={message.subagents} />
            )}

            {hasAttachments && (
              <MessageAttachmentsView attachments={message.attachments!} isUser={false} />
            )}

            {message.content ? (
              <MarkdownRenderer content={message.content} isGenerating={isGenerating} />
            ) : isGenerating && !message.toolApproval ? (
              <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                <span className="shimmer">답변을 생성하고 있습니다...</span>
              </div>
            ) : message.status === "error" ||
              message.error ||
              message.toolApproval ||
              (message.todos && message.todos.length > 0) ? null : (
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

            {/* Error Message & Retry Alert */}
            {(message.status === "error" || message.error) && (
              <Alert variant="destructive" className="w-full max-w-md">
                <AlertCircle className="size-4" />
                <div className="flex items-center justify-between gap-3 w-full">
                  <AlertDescription className="truncate">
                    {message.error || "답변 생성 중 오류가 발생했습니다."}
                  </AlertDescription>
                  {onRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[11px] gap-1 shrink-0 cursor-pointer"
                      onClick={onRetry}
                      disabled={isGenerating}
                    >
                      <RotateCw data-icon="inline-start" />
                      <span>재시도</span>
                    </Button>
                  )}
                </div>
              </Alert>
            )}
          </div>
        )}

        {/* Action Bar (Quick Actions) */}
        {!isEditing && (
          <MessageFooter className="gap-2 mt-1">
            <div className="flex items-center gap-0.5 opacity-60 group-hover/message:opacity-100 transition-opacity duration-150">
              {/* Copy */}
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleCopy}
                title="메시지 복사"
              >
                {copied ? (
                  <Check data-icon="inline-start" className="text-primary" />
                ) : (
                  <Copy data-icon="inline-start" />
                )}
              </Button>

              {/* Edit (User only) */}
              {isUser && onEdit && !isGenerating && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => {
                    setEditDraft(message.content);
                    setIsEditing(true);
                  }}
                  title="메시지 수정 (새 분기)"
                >
                  <Edit2 data-icon="inline-start" />
                </Button>
              )}

              {/* Regenerate (Assistant only) */}
              {!isUser && !isGenerating && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={onRegenerate}
                  title="답변 다시 생성"
                >
                  <RotateCw data-icon="inline-start" />
                </Button>
              )}

              {/* Fork Session (Assistant only) */}
              {!isUser && onFork && !isGenerating && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={onFork}
                  title="이 답변부터 새 대화 세션으로 분기 (Fork)"
                >
                  <GitFork data-icon="inline-start" />
                </Button>
              )}

              {/* Delete Message */}
              {!isGenerating && (
                showDeleteConfirm ? (
                  <div className="inline-flex items-center gap-1 bg-destructive/10 px-1.5 py-0.5 rounded-lg border border-destructive/30 animate-in fade-in-50 duration-150">
                    <span className="text-[10px] text-destructive font-medium">삭제할까요?</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-5 text-destructive hover:bg-destructive/20 cursor-pointer"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        onDelete();
                      }}
                      title="확인"
                    >
                      <Check data-icon="inline-start" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-5 text-muted-foreground hover:bg-muted cursor-pointer"
                      onClick={() => setShowDeleteConfirm(false)}
                      title="취소"
                    >
                      <X data-icon="inline-start" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive cursor-pointer"
                    onClick={() => setShowDeleteConfirm(true)}
                    title="메시지 삭제"
                  >
                    <Trash2 data-icon="inline-start" />
                  </Button>
                )
              )}
            </div>
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  );
}
