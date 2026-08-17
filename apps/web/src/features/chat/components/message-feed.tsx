"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Bot, Paperclip, Sparkles, Square, Terminal } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import {
  MessageScroller,
  MessageScrollerProvider,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
} from "@repo/ui/components/message-scroller";
import { useChatEngine } from "../hooks/use-chat-engine";
import { useDirectUpload } from "../hooks/use-direct-upload";
import { MessageItem } from "./message-item";
import { AttachmentStagingBar } from "./attachment-staging-bar";

interface MessageFeedProps {
  sessionId: string;
  onOpenArtifacts?: () => void;
}

const STARTER_PROMPTS = [
  {
    title: "피보나치 수열 알고리즘",
    prompt: "파이썬으로 최적화된 피보나치 수열 생성 함수를 작성하고 시간 복잡도를 설명해줘.",
    icon: Terminal,
  },
  {
    title: "데이터베이스 모델링",
    prompt: "계층적 메시지 트리를 위한 PostgreSQL 인접 리스트 스키마를 설계해줘.",
    icon: Sparkles,
  },
  {
    title: "수학 수식 및 정리",
    prompt: "오일러의 공식 $e^{i\\pi} + 1 = 0$과 테일러 급수 전개를 LaTeX 수식으로 유도해줘.",
    icon: Bot,
  },
];

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
    if ((!inputPrompt.trim() && completedAttachments.length === 0) || isGenerating || isUploading) {
      return;
    }
    const content = inputPrompt.trim();
    const attachments = completedAttachments.length > 0 ? [...completedAttachments] : undefined;

    setInputPrompt("");
    clearStaged();

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
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
    if (isGenerating || isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const isSendDisabled =
    (!inputPrompt.trim() && completedAttachments.length === 0) || isUploading;

  return (
    <div className="flex flex-col h-full w-full min-h-0 relative">
      {/* Scrollable Message Feed Area with shadcn MessageScroller */}
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="flex-1 min-h-0 w-full">
          <MessageScrollerViewport className="w-full h-full px-3 sm:px-6 py-4 no-scrollbar scrollbar-none">
            {isLoading && activePath.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-2 max-w-4xl mx-auto">
                <span className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-xs">대화 기록을 불러오는 중입니다...</p>
              </div>
            ) : activePath.length === 0 ? (
              /* Empty Starter State */
              <div className="flex flex-col items-center justify-center min-h-[400px] h-full text-center px-4 max-w-4xl mx-auto">
                <div className="flex items-center justify-center size-12 rounded-2xl bg-primary/10 text-primary mb-3 shadow-xs">
                  <Bot className="size-6" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Hollow Echo AI 어시스턴트</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
                  마크다운, LaTeX 수식, 코드 블록, 이미지 및 문서 첨부를 완벽히 지원합니다. 자유롭게 대화를 시작해 보세요.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 w-full max-w-3xl">
                  {STARTER_PROMPTS.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          send(item.prompt);
                        }}
                        className="flex flex-col items-start p-3.5 rounded-2xl bg-card border border-border/70 hover:border-primary/50 hover:bg-muted/30 transition-all text-left group shadow-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          <Icon className="size-4 text-primary shrink-0" />
                          <span>{item.title}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {item.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Message List */
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
                        onRegenerate={() => {
                          regenerate(msg.id);
                        }}
                        onDelete={() => deleteNode(msg.id)}
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
            )}
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>

      {/* Bottom Floating Prompt Box with File Upload Staging & Dynamic Send/Stop Toggle Button */}
      <div className="shrink-0 w-full px-3 sm:px-6 pb-4 pt-1 bg-gradient-to-t from-background via-background/95 to-transparent">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="relative max-w-4xl mx-auto flex flex-col rounded-2xl bg-card border border-border/80 shadow-md focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 transition-all"
        >
          {/* File Attachment Staging Bar */}
          <AttachmentStagingBar
            stagedFiles={stagedFiles}
            onRemove={removeFile}
            disabled={isGenerating}
          />

          <Textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            placeholder={
              isGenerating
                ? "AI가 답변을 작성하고 있습니다... (필요시 중지 가능)"
                : isUploading
                ? "파일을 업로드하는 중입니다..."
                : "무엇이든 물어보세요... (Enter: 전송, Shift+Enter: 줄바꿈, 파일 드래그앤드롭)"
            }
            className="min-h-[52px] max-h-[180px] resize-none border-none shadow-none focus-visible:ring-0 text-sm px-4 py-3 bg-transparent leading-relaxed disabled:opacity-60 disabled:cursor-not-allowed"
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
                disabled={isGenerating || isUploading}
                title="파일 첨부 (이미지, PDF, TXT, CSV, JSON, MD)"
              >
                <Paperclip data-icon="inline-start" />
              </Button>
              <span className="text-[11px] text-muted-foreground/80 select-none">
                {isGenerating
                  ? "답변 생성 진행 중"
                  : isUploading
                  ? "파일 업로드 중..."
                  : "선형 대화 세션 및 멀티모달 첨부 지원"}
              </span>
            </div>

            {isGenerating ? (
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
                title="메시지 전송 (Enter)"
              >
                <ArrowUp data-icon="inline-start" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Alias for backward compatibility
export const MessageTreeFeed = MessageFeed;
