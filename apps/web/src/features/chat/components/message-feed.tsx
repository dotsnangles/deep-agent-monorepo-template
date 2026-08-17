"use client";

import { useContext, useEffect, useRef, useState } from "react";
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
import { authClient } from "../../../lib/auth-client";
import { ChatSessionContext } from "../context/chat-session-context";
import { useChatEngine } from "../hooks/use-chat-engine";
import { useDirectUpload } from "../hooks/use-direct-upload";
import { getRandomGreeting, getSessionGreeting } from "../lib/greetings";
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

  // Focus textarea on session change or mount
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 20);
    return () => clearTimeout(focusTimer);
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
    // Prevent premature sending during IME (e.g. Korean) character composition
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    if (e.key === "Enter") {
      if (e.shiftKey) {
        // Shift + Enter: Allow natural multiline newline insertion in textarea
        return;
      }
      // Enter alone: Send message
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

  const [greetingIndex, setGreetingIndex] = useState(() =>
    Math.floor(Math.random() * 8)
  );

  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      prevSessionIdRef.current = sessionId;
      setGreetingIndex(Math.floor(Math.random() * 8));
    }
  }, [sessionId]);

  const { data: authSession, isPending: isAuthPending } = authClient.useSession();
  const userName = authSession?.user?.name
    ? authSession.user.name.split(" ")[0] || authSession.user.name
    : null;

  const greetingText = getRandomGreeting(userName, greetingIndex);

  const chatSessionsContext = useContext(ChatSessionContext);
  const isExistingSession = chatSessionsContext
    ? chatSessionsContext.sessions.some((s) => s.id === sessionId)
    : false;

  const isEmpty = !isExistingSession && activePath.length === 0;

  return (
    <div className="flex flex-col h-full w-full min-h-0 relative overflow-hidden">
      {/* 1. Ambient Gemini Radial Glow / Aura (어스름) - Centered & continuous organic movement */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-700 ease-out z-0 select-none overflow-hidden",
          isEmpty
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        )}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Primary Luminous Deep Blue/Cyan Glow Orb */}
          <div className="gemini-ambient-glow w-[560px] sm:w-[820px] h-[340px] sm:h-[480px] rounded-full shrink-0" />

          {/* Secondary Violet/Indigo Counter-Movement Orb for organic depth */}
          <div className="gemini-ambient-glow-secondary absolute w-[460px] sm:w-[680px] h-[280px] sm:h-[380px] rounded-full shrink-0" />
        </div>
      </div>

      {/* 2. Upper Dynamic Zone: Smoothly collapses from Center Hero to Message Feed */}
      <div className="flex-1 min-h-0 w-full flex flex-col justify-end relative overflow-hidden z-10">
        {/* Gemini-style Center Hero Title (Floats up on entrance, collapses upwards when messages appear) */}
        <div
          className={cn(
            "w-full flex flex-col items-center justify-end transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden shrink-0",
            isEmpty
              ? "flex-1 opacity-100 scale-100 max-h-[45vh] pb-8 pointer-events-auto"
              : "max-h-0 opacity-0 scale-95 pointer-events-none pb-0 -translate-y-6"
          )}
        >
          <h1
            suppressHydrationWarning
            className={cn(
              "text-3xl sm:text-4xl font-normal tracking-tight text-foreground/90 text-center select-none transition-opacity duration-300",
              isAuthPending
                ? "opacity-0 invisible"
                : "opacity-100 visible animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out"
            )}
          >
            {greetingText}
          </h1>
        </div>

        {/* Scrollable Message Feed Area with shadcn MessageScroller */}
        <div
          className={cn(
            "w-full flex-1 min-h-0 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            isEmpty ? "opacity-0 pointer-events-none max-h-0 overflow-hidden" : "opacity-100 pointer-events-auto"
          )}
        >
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
        </div>
      </div>

      {/* 2. Persistent Single Prompt Box (Smoothly glides from Center to Bottom) */}
      <div
        className={cn(
          "w-full px-3 sm:px-6 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0",
          isEmpty
            ? "flex-1 flex flex-col items-center justify-start pt-0 pb-12"
            : "pb-4 pt-1 bg-gradient-to-t from-background via-background/95 to-transparent flex-none"
        )}
      >
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={cn(
            "relative w-full flex flex-col rounded-2xl bg-card border border-border/70 shadow-md transition-all duration-300",
            stagedFiles.length > 0 ? "p-2.5" : "px-3 py-2",
            isEmpty ? "max-w-3xl shadow-lg" : "max-w-4xl mx-auto"
          )}
        >
          {/* File Attachment Staging Bar */}
          {stagedFiles.length > 0 && (
            <AttachmentStagingBar
              stagedFiles={stagedFiles}
              onRemove={removeFile}
              disabled={isUploading}
            />
          )}

          {/* Single Row Horizontal Bar */}
          <div className="flex items-center w-full min-h-[40px] gap-2">
            {/* File Attachment Trigger */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="파일 첨부 (이미지, PDF, TXT, CSV, JSON, MD)"
            >
              <Paperclip className="size-4" />
            </Button>

            {/* Input Textarea */}
            <Textarea
              ref={textareaRef}
              autoFocus
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isUploading
                  ? "파일을 업로드하는 중입니다..."
                  : isGenerating
                  ? "답변 생성 중... (새 질문 작성 후 Enter 시 전송)"
                  : "무엇이든 물어보세요... (Enter: 전송, Shift+Enter: 줄바꿈, 파일 드래그앤드롭)"
              }
              className="flex-1 min-h-[38px] max-h-[160px] resize-none border-none shadow-none focus-visible:ring-0 focus:ring-0 focus:outline-none text-sm px-2 py-2 bg-transparent dark:bg-transparent leading-relaxed"
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

            {/* Right Action Button (Send / Stop) */}
            <div className="flex items-center shrink-0">
              {isGenerating ? (
                <Button
                  type="button"
                  size="icon"
                  className="size-8 rounded-xl shadow-xs bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer animate-in zoom-in-90 duration-150"
                  onClick={stop}
                  title="답변 생성 중단 (Stop)"
                >
                  <Square className="size-3.5 fill-current" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  disabled={isSendDisabled}
                  className="size-8 rounded-xl shadow-xs cursor-pointer"
                  onClick={handleSend}
                  title="메시지 전송 (Enter)"
                >
                  <ArrowUp className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Alias for backward compatibility
export const MessageTreeFeed = MessageFeed;
