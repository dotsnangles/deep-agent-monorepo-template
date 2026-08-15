"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Bot, Sparkles, Terminal } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { useMessageTree } from "../hooks/use-message-tree";
import { useSmartScroll } from "../hooks/use-smart-scroll";
import { MessageItem } from "./message-item";

interface MessageTreeFeedProps {
  sessionId: string;
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

export function MessageTreeFeed({ sessionId }: MessageTreeFeedProps) {
  const {
    allNodes,
    activePath,
    isLoading,
    isGenerating,
    sendMessage,
    editUserMessage,
    regenerateAssistantMessage,
    deleteMessage,
    navigateSibling,
  } = useMessageTree(sessionId);

  const [inputPrompt, setInputPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    scrollRef,
    showScrollBottomButton,
    isPinnedToBottomRef,
    scrollToBottom,
    handleScroll,
  } = useSmartScroll();

  // Auto-scroll on streaming or new messages ONLY if pinned to bottom
  useEffect(() => {
    if (isPinnedToBottomRef.current) {
      scrollToBottom("instant");
    }
  }, [activePath, isGenerating, scrollToBottom, isPinnedToBottomRef]);

  // Focus textarea & reset scroll on session change
  useEffect(() => {
    scrollToBottom("auto");
    textareaRef.current?.focus();
  }, [sessionId, scrollToBottom]);

  // Auto-adjust textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }
  }, [inputPrompt]);

  const handleSend = () => {
    if (!inputPrompt.trim() || isGenerating) return;
    const content = inputPrompt.trim();
    setInputPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    sendMessage(content);
    scrollToBottom("smooth");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto min-h-0 relative">
      {/* Scrollable Message Feed Area with Smart Scroll Tracking */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 space-y-4"
      >
        {isLoading && activePath.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-2">
            <span className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs">대화 기록을 불러오는 중입니다...</p>
          </div>
        ) : activePath.length === 0 ? (
          /* Empty Starter State */
          <div className="flex flex-col items-center justify-center min-h-[400px] h-full text-center px-4">
            <div className="flex items-center justify-center size-12 rounded-2xl bg-primary/10 text-primary mb-3 shadow-xs">
              <Bot className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Hollow Echo AI 어시스턴트</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
              마크다운, LaTeX 수식, 코드 블록을 완벽히 지원합니다. 자유롭게 질문하거나 이전 메시지를 수정하여 대화 분기를 탐색해 보세요.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 w-full max-w-3xl">
              {STARTER_PROMPTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      sendMessage(item.prompt);
                      scrollToBottom("smooth");
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
          <div className="space-y-4">
            {activePath.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                allNodes={allNodes}
                isGenerating={isGenerating}
                onNavigateSibling={(direction) => navigateSibling(msg.id, direction)}
                onEdit={(newContent) => editUserMessage(msg.id, newContent)}
                onRegenerate={() => {
                  regenerateAssistantMessage(msg.id);
                  scrollToBottom("smooth");
                }}
                onDelete={() => deleteMessage(msg.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating 'Scroll to Bottom' Button when user scrolled up */}
      {showScrollBottomButton && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 animate-in fade-in zoom-in-95 duration-150">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => scrollToBottom("smooth")}
            className="rounded-full shadow-lg border border-border/80 text-xs px-3.5 py-1.5 gap-1.5 bg-background/95 hover:bg-muted backdrop-blur-xs cursor-pointer text-foreground font-medium"
          >
            <ArrowDown className="size-3.5 text-primary animate-bounce" />
            <span>최신 메시지 보기</span>
          </Button>
        </div>
      )}

      {/* Bottom Floating Prompt Box */}
      <div className="shrink-0 px-3 sm:px-6 pb-4 pt-1 bg-gradient-to-t from-background via-background/95 to-transparent">
        <div className="relative flex flex-col rounded-2xl bg-card border border-border/80 shadow-md focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15 transition-all">
          <Textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="무엇이든 물어보세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
            className="min-h-[52px] max-h-[180px] resize-none border-none shadow-none focus-visible:ring-0 text-sm px-4 py-3 bg-transparent leading-relaxed"
            disabled={isGenerating}
            rows={1}
          />
          <div className="flex items-center justify-between px-3.5 pb-2.5 pt-0.5">
            <span className="text-[11px] text-muted-foreground/80 select-none">
              대화 분기 지원 (수정 시 새 브랜치 생성)
            </span>
            <Button
              size="icon"
              className="size-8 rounded-xl shadow-xs"
              onClick={handleSend}
              disabled={isGenerating || !inputPrompt.trim()}
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
