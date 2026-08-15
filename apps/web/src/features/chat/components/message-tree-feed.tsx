"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, Sparkles, Terminal } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { useMessageTree } from "../hooks/use-message-tree";
import { MessageItem } from "./message-item";

interface MessageTreeFeedProps {
  sessionId: string;
}

const STARTER_PROMPTS = [
  {
    title: "피보나치 수열 알고리즘",
    prompt: "파이썬으로 최적화된 피보나치 수열 생성 함수를 작성해줘.",
    icon: Terminal,
  },
  {
    title: "데이터베이스 모델링",
    prompt: "채팅 시스템의 계층적 메시지 트리를 위한 PostgreSQL 스키마를 설계해줘.",
    icon: Sparkles,
  },
  {
    title: "아키텍처 설계 질문",
    prompt: "마이크로서비스와 모듈러 모놀리스의 장단점을 비교해줘.",
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on active path changes or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activePath, isGenerating]);

  // Focus textarea on load
  useEffect(() => {
    textareaRef.current?.focus();
  }, [sessionId]);

  const handleSend = () => {
    if (!inputPrompt.trim() || isGenerating) return;
    const content = inputPrompt.trim();
    setInputPrompt("");
    sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto min-h-0 relative">
      {/* Scrollable Message Feed Area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 py-4 space-y-4">
        {isLoading && activePath.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-muted-foreground gap-2">
            <span className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs">대화 기록을 불러오는 중입니다...</p>
          </div>
        ) : activePath.length === 0 ? (
          /* Empty Starter State */
          <div className="flex flex-col items-center justify-center min-h-[380px] h-full text-center px-4">
            <div className="flex items-center justify-center size-12 rounded-2xl bg-primary/10 text-primary mb-3 shadow-xs">
              <Bot className="size-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Hollow Echo AI 어시스턴트</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              질문을 입력하거나 질문을 수정하여 자유롭게 새로운 대화 분기를 탐색해 보세요.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-6 w-full max-w-2xl">
              {STARTER_PROMPTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => sendMessage(item.prompt)}
                    className="flex flex-col items-start p-3 rounded-xl bg-card border border-border/60 hover:border-primary/50 hover:bg-muted/40 transition-all text-left group shadow-2xs cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                      <Icon className="size-3.5" />
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {item.prompt}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Message List */
          <div className="space-y-3">
            {activePath.map((msg) => (
              <MessageItem
                key={msg.id}
                message={msg}
                allNodes={allNodes}
                isGenerating={isGenerating}
                onNavigateSibling={(direction) => navigateSibling(msg.id, direction)}
                onEdit={(newContent) => editUserMessage(msg.id, newContent)}
                onRegenerate={() => regenerateAssistantMessage(msg.id)}
                onDelete={() => deleteMessage(msg.id)}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Floating Prompt Box */}
      <div className="shrink-0 p-3 pt-1 bg-background/80 backdrop-blur-xs border-t border-border/40">
        <div className="relative flex flex-col rounded-2xl bg-card border border-border/70 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="무엇이든 물어보거나 작업을 요청하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
            className="min-h-[56px] max-h-[160px] resize-none border-none shadow-none focus-visible:ring-0 text-xs px-4 py-3 bg-transparent"
            disabled={isGenerating}
          />
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
            <span className="text-[10px] text-muted-foreground/70 select-none">
              대화 분기 지원 (수정 ✏️ 시 새 브랜치 자동 생성)
            </span>
            <Button
              size="icon"
              className="size-7 rounded-lg shadow-xs"
              onClick={handleSend}
              disabled={isGenerating || !inputPrompt.trim()}
            >
              <ArrowUp className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
