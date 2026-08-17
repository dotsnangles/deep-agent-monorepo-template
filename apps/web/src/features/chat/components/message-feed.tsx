"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Paperclip, Square } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
} from "@repo/ui/components/message-scroller";
import { cn } from "@repo/ui/lib/utils";
import { useChatEngine } from "../hooks/use-chat-engine";
import { useDirectUpload } from "../hooks/use-direct-upload";
import { MessageItem } from "./message-item";
import { AttachmentStagingBar } from "./attachment-staging-bar";

interface MessageFeedProps {
  sessionId: string;
  onOpenArtifacts?: () => void;
}

export function MessageFeed({ sessionId, onOpenArtifacts }: MessageFeedProps) {
  const router = useRouter();
  const {
    activePath,
    isLoading,
    isGenerating,
    generatingAssistantId,
    send,
    respondToApproval,
    regenerate,
    deleteNode,
    retry,
    forkSession,
    forkAndEdit,
    stop,
  } = useChatEngine(sessionId);

  const lastUserIndex = activePath.map((m) => m.role).lastIndexOf("user");
  const lastAssistantIndex = activePath.map((m) => m.role).lastIndexOf("assistant");

  const {
    stagedFiles,
    isUploading,
    completedAttachments,
    addFiles,
    removeFile,
    clearStaged,
  } = useDirectUpload({ sessionId });

  const [inputPrompt, setInputPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus textarea on session change
  useEffect(() => {
    textareaRef.current?.focus();
  }, [sessionId]);

  // Auto-adjust textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }
  }, [inputPrompt]);

  const handleSend = () => {
    if ((!inputPrompt.trim() && completedAttachments.length === 0) || isUploading) {
      return;
    }
    const content = inputPrompt.trim();
    const attachments = completedAttachments.length > 0 ? [...completedAttachments] : undefined;

    setInputPrompt("");
    clearStaged();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    if (isGenerating) {
      stop();
    }

    send(content, attachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const isSendDisabled =
    (!inputPrompt.trim() && completedAttachments.length === 0) || isUploading;

  // Unified reusable prompt box
  const renderPromptBox = (isCenterMode = false) => (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className={cn(
        "relative w-full flex flex-col rounded-2xl bg-card border border-border/80 shadow-md focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 transition-all",
        isCenterMode ? "max-w-3xl shadow-lg border-border/90" : "max-w-4xl mx-auto"
      )}
    >
      {/* File Attachment Staging Bar */}
      <AttachmentStagingBar
        stagedFiles={stagedFiles}
        onRemove={removeFile}
        disabled={isUploading}
      />

      <Textarea
        ref={textareaRef}
        value={inputPrompt}
        onChange={(e) => setInputPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isUploading
            ? "파일을 업로드하는 중입니다..."
            : isGenerating
            ? "답변 생성 중... (새 질문 작성 후 Enter 시 이전 생성 중단 후 전송)"
            : "무엇이든 물어보세요... (Enter: 전송, Shift+Enter: 줄바꿈, 파일 드래그앤드롭)"
        }
        className="min-h-[52px] max-h-[180px] resize-none border-none shadow-none focus-visible:ring-0 text-sm px-4 py-3 bg-transparent leading-relaxed"
        rows={1}
      />

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,application/json"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files);
          }
          e.target.value = "";
        }}
      />

      <div className="flex items-center justify-between px-3.5 pb-2.5 pt-0.5">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="파일 첨부 (이미지, PDF, TXT, CSV, JSON, MD)"
          >
            <Paperclip data-icon="inline-start" />
          </Button>
          <span className="text-[11px] text-muted-foreground/80 select-none">
            {isUploading
              ? "파일 업로드 중..."
              : isGenerating
              ? "답변 생성 진행 중"
              : "선형 대화 세션 및 멀티모달 첨부 지원"}
          </span>
        </div>

        {isGenerating && !inputPrompt.trim() && completedAttachments.length === 0 ? (
          <Button
            type="button"
            size="icon"
            className="size-8 rounded-xl shadow-xs bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer animate-in zoom-in-90 duration-150"
            onClick={stop}
            title="답변 생성 중단 (Stop)"
          >
            <Square data-icon="inline-start" className="fill-current" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            className="size-8 rounded-xl shadow-xs"
            onClick={handleSend}
            disabled={isSendDisabled}
            title={isGenerating ? "생성 중단 및 새 질문 전송 (Enter)" : "메시지 전송 (Enter)"}
          >
            <ArrowUp data-icon="inline-start" />
          </Button>
        )}
      </div>
    </div>
  );

  // 1. Loading State
  if (isLoading && activePath.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full min-h-[300px] text-muted-foreground gap-2 max-w-4xl mx-auto">
        <span className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-xs">대화 기록을 불러오는 중입니다...</p>
      </div>
    );
  }

  // 2. Gemini-style Airy Centered Empty Starter State
  if (activePath.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full px-4 sm:px-6 relative">
        <div className="w-full max-w-3xl flex flex-col items-center -mt-12 animate-in fade-in-50 duration-300">
          <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-foreground/90 text-center mb-8 select-none">
            Where should we start?
          </h1>
          <div className="w-full">
            {renderPromptBox(true)}
          </div>
        </div>
      </div>
    );
  }

  // 3. Active Message Thread
  return (
    <div className="flex flex-col h-full w-full min-h-0 relative">
      {/* Scrollable Message Feed Area with shadcn MessageScroller */}
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1 min-h-0 w-full">
          <MessageScrollerViewport className="w-full h-full px-3 sm:px-6 py-4 no-scrollbar scrollbar-none">
            <MessageScrollerContent className="gap-4 max-w-4xl w-full mx-auto pb-4">
              {activePath.map((msg, index) => {
                const isLast = index === activePath.length - 1;
                const isLastUser = msg.role === "user" && index === lastUserIndex;
                const isStreamingThisMessage =
                  isGenerating &&
                  ((generatingAssistantId && msg.id === generatingAssistantId) ||
                    (!generatingAssistantId && isLast && msg.role === "assistant"));

                return (
                  <MessageScrollerItem key={msg.id}>
                    <MessageItem
                      message={msg}
                      isGenerating={isStreamingThisMessage}
                      onEdit={
                        isLastUser && !isGenerating
                          ? (newContent) => {
                              forkAndEdit(msg.id, newContent);
                            }
                          : undefined
                      }
                      onRegenerate={
                        index === lastAssistantIndex && !isGenerating
                          ? () => {
                              regenerate(msg.id);
                            }
                          : undefined
                      }
                      onRetry={() => {
                        retry(msg.id);
                      }}
                      onFork={async () => {
                        const result = await forkSession(msg.id);
                        if (result?.newSessionId) {
                          router.push(`/chat/${result.newSessionId}` as any);
                        }
                      }}
                      onApprove={(toolCallId) => {
                        respondToApproval(toolCallId, true);
                      }}
                      onReject={(toolCallId, reason) => {
                        respondToApproval(toolCallId, false, reason);
                      }}
                      onOpenArtifact={() => onOpenArtifacts?.()}
                    />
                  </MessageScrollerItem>
                );
              })}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>

      {/* Bottom Floating Prompt Box with File Upload Staging & Dynamic Send/Stop Toggle Button */}
      <div className="shrink-0 w-full px-3 sm:px-6 pb-4 pt-1 bg-gradient-to-t from-background via-background/95 to-transparent">
        {renderPromptBox(false)}
      </div>
    </div>
  );
}

// Alias for backward compatibility
export const MessageTreeFeed = MessageFeed;
