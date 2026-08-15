"use client";

import * as React from "react";
import { Search, X, MessageSquare, ArrowRight, Clock } from "lucide-react";
import { useChatSessions, type ChatSession } from "../context/chat-session-context";
import { Badge } from "@repo/ui/components/badge";

function formatSessionDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return "오늘";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return "어제";
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (date.getFullYear() === now.getFullYear()) {
    return `${month}월 ${day}일`;
  }

  return `${date.getFullYear()}년 ${month}월 ${day}일`;
}

export function ChatSearchDialog() {
  const {
    sessions,
    activeSessionId,
    switchSession,
    isSearchOpen,
    closeSearch,
  } = useChatSessions();

  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);

  // Auto focus input when opened
  React.useEffect(() => {
    if (isSearchOpen) {
      setQuery("");
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen]);

  const filteredSessions = React.useMemo(() => {
    if (!query.trim()) return sessions;
    const lower = query.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(lower));
  }, [sessions, query]);

  // Handle keyboard navigation (Arrow Up/Down, Enter, Esc)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredSessions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredSessions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredSessions[selectedIndex]) {
        handleSelectSession(filteredSessions[selectedIndex].id);
      }
    }
  };

  const handleSelectSession = (id: string) => {
    switchSession(id);
    closeSearch();
  };

  if (!isSearchOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-background/80 backdrop-blur-md animate-in fade-in-0 duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSearch();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-2xl bg-card/95 border border-border/70 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] backdrop-blur-xl animate-in zoom-in-95 duration-150">
        {/* Gemini-style Capsule Search Input Bar */}
        <div className="p-4 border-b border-border/50 bg-background/50">
          <div className="relative flex items-center w-full rounded-full bg-muted/60 border border-border/60 hover:border-primary/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all px-4 py-2.5">
            <Search className="size-4.5 text-muted-foreground mr-3 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="대화 검색..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="size-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted ml-2"
              >
                <X className="size-3.5" />
                <span className="sr-only">검색어 삭제</span>
              </button>
            ) : (
              <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4.5 text-muted-foreground">
                ESC
              </Badge>
            )}
          </div>
        </div>

        {/* Sessions List Area */}
        <div className="flex-1 overflow-y-auto p-3" ref={listRef}>
          <div className="flex items-center justify-between px-3 py-1.5 mb-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {query ? `검색 결과 (${filteredSessions.length})` : "최근 대화"}
            </span>
            {sessions.length > 0 && !query && (
              <span className="text-[11px] text-muted-foreground/70">
                총 {sessions.length}개의 대화
              </span>
            )}
          </div>

          {filteredSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <MessageSquare className="size-8 stroke-1 text-muted-foreground/40" />
              <span>{query ? "일치하는 대화가 없습니다." : "대화 기록이 없습니다."}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredSessions.map((session, index) => {
                const isActive = session.id === activeSessionId;
                const isSelected = index === selectedIndex;
                const dateLabel = formatSessionDate(session.updatedAt || session.createdAt);

                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`group flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-100 ${
                      isSelected
                        ? "bg-muted/80 text-foreground"
                        : "hover:bg-muted/40 text-foreground/90"
                    } ${isActive ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                      <MessageSquare
                        className={`size-4 shrink-0 ${
                          isActive
                            ? "text-primary"
                            : isSelected
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="truncate text-xs font-medium">
                        {session.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {dateLabel && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {dateLabel}
                        </span>
                      )}
                      {isSelected && (
                        <ArrowRight className="size-3.5 text-muted-foreground group-hover:text-foreground opacity-60 animate-in fade-in-0 duration-100" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Tips */}
        <div className="px-4 py-2 border-t border-border/40 bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ 이동</span>
            <span>↵ 선택</span>
            <span>ESC 닫기</span>
          </div>
          <span>⌘K 로 언제든 검색</span>
        </div>
      </div>
    </div>
  );
}
