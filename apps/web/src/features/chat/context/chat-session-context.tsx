"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "../../../lib/auth-client";
import { toast } from "sonner";
import { globalChatEngineRegistry } from "../engine";
import { DEFAULT_SESSION_TITLE } from "../lib/session-title";

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSessionContextType {
  sessions: ChatSession[];
  activeSessionId: string;
  isLoading: boolean;
  isDraft: boolean;
  isSearchOpen: boolean;
  generatingSessionIds: string[];
  isSessionGenerating: (id: string) => boolean;
  optimisticAddSession: (id: string, title?: string) => void;
  setIsSearchOpen: (open: boolean) => void;
  openSearch: () => void;
  closeSearch: () => void;
  createNewSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, newTitle: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

export const ChatSessionContext = createContext<ChatSessionContextType | null>(null);

const STORAGE_KEY = "hollow_echo_active_thread_id";

function createDraftSession(id: string, title = DEFAULT_SESSION_TITLE, userId = "guest"): ChatSession {
  return {
    id,
    userId,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function ChatSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) || crypto.randomUUID();
    }
    return "default-session";
  });
  const { data: sessionData, isPending: isAuthPending } = authClient.useSession();
  const [isSessionsLoading, setIsSessionsLoading] = useState<boolean>(true);
  const [generatingSessionIds, setGeneratingSessionIds] = useState<string[]>(() =>
    globalChatEngineRegistry.getGeneratingSessionIds()
  );

  const isLoading = isAuthPending || isSessionsLoading;

  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  // Global keyboard shortcut for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Save active session id to localStorage
  const updateActiveSessionId = useCallback((id: string) => {
    setActiveSessionId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const fetchSessions = useCallback(
    async (silent = false) => {
      if (isAuthPending) {
        return;
      }
      if (!sessionData?.user) {
        setIsSessionsLoading(false);
        return;
      }
      try {
        if (!silent) setIsSessionsLoading(true);
        const res = await fetch("/api/chat/sessions");
        if (res.ok) {
          const data = await res.json();
          const fetchedSessions: ChatSession[] = data.sessions || [];
          setSessions((prev) => {
            // Keep active generating sessions that might not be in DB yet
            const currentGeneratingIds = globalChatEngineRegistry.getGeneratingSessionIds();
            const memorySessions: ChatSession[] = currentGeneratingIds
              .filter((genId) => !fetchedSessions.some((s) => s.id === genId))
              .map((genId) => {
                const existing = prev.find((p) => p.id === genId);
                return existing || createDraftSession(genId, DEFAULT_SESSION_TITLE, sessionData?.user?.id);
              });

            return [...memorySessions, ...fetchedSessions];
          });
        }
      } catch (error) {
        console.error("[ChatSessionProvider] Failed to fetch chat sessions:", error);
      } finally {
        setIsSessionsLoading(false);
      }
    },
    [sessionData?.user, isAuthPending]
  );

  // Initial fetch on user auth readiness
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Event-driven revalidation on window focus (replaces 4s polling timer)
  useEffect(() => {
    const onFocus = () => {
      fetchSessions(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchSessions]);

  // Optimistically add session to local list or update placeholder title
  const optimisticAddSession = useCallback(
    (id: string, title = DEFAULT_SESSION_TITLE) => {
      setSessions((prev) => {
        const existingIdx = prev.findIndex((s) => s.id === id);
        if (existingIdx !== -1) {
          const existing = prev[existingIdx];
          if (existing.title === DEFAULT_SESSION_TITLE && title !== DEFAULT_SESSION_TITLE) {
            const updated = [...prev];
            updated[existingIdx] = { ...existing, title };
            return updated;
          }
          return prev;
        }
        return [createDraftSession(id, title, sessionData?.user?.id), ...prev];
      });
    },
    [sessionData?.user?.id]
  );

  // Subscribe to ChatEngineRegistry event bus (replaces legacy StreamManager polling & subscriptions)
  useEffect(() => {
    return globalChatEngineRegistry.subscribe((event) => {
      setGeneratingSessionIds(globalChatEngineRegistry.getGeneratingSessionIds());

      if (event.type === "sessionCreated") {
        optimisticAddSession(event.sessionId, event.payload?.title || DEFAULT_SESSION_TITLE);
      } else if (event.type === "titleUpdated") {
        setSessions((prev) =>
          prev.map((s) => (s.id === event.sessionId ? { ...s, title: event.payload.title } : s))
        );
      } else if (event.type === "streamCompleted") {
        // Silently revalidate database state on stream completion
        fetchSessions(true);
      }
    });
  }, [optimisticAddSession, fetchSessions]);

  const isSessionGenerating = useCallback(
    (id: string) => generatingSessionIds.includes(id),
    [generatingSessionIds]
  );

  const isDraft = !sessions.some((s) => s.id === activeSessionId);

  const createNewSession = () => {
    if (pathname !== "/") {
      router.push("/");
    }

    const newId = crypto.randomUUID();
    updateActiveSessionId(newId);
  };

  const switchSession = (id: string) => {
    updateActiveSessionId(id);
    if (pathname !== "/") {
      router.push("/");
    }
  };

  const deleteSession = async (id: string) => {
    globalChatEngineRegistry.notifySessionDeleted(id);

    if (sessionData?.user) {
      try {
        const res = await fetch(`/api/chat/sessions/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed");
      } catch (error) {
        console.error("[ChatSessionProvider] Failed to delete session:", error);
        toast.error("세션 삭제에 실패했습니다.");
        return;
      }
    }

    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    toast.success("대화 세션이 삭제되었습니다.");

    if (activeSessionId === id) {
      if (remaining.length > 0) {
        updateActiveSessionId(remaining[0].id);
      } else {
        updateActiveSessionId(crypto.randomUUID());
      }
    }
  };

  const renameSession = async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    if (sessionData?.user) {
      try {
        const res = await fetch(`/api/chat/sessions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        });
        if (!res.ok) throw new Error("Rename failed");
      } catch (error) {
        console.error("[ChatSessionProvider] Failed to rename session:", error);
        toast.error("세션 이름 변경에 실패했습니다.");
        return;
      }
    }

    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s))
    );
    globalChatEngineRegistry.notifyTitleUpdated(id, trimmed);
    toast.success("세션 이름이 변경되었습니다.");
  };

  return (
    <ChatSessionContext.Provider
      value={{
        sessions,
        activeSessionId,
        isLoading,
        isDraft,
        isSearchOpen,
        generatingSessionIds,
        isSessionGenerating,
        optimisticAddSession,
        setIsSearchOpen,
        openSearch,
        closeSearch,
        createNewSession,
        switchSession,
        deleteSession,
        renameSession,
        refreshSessions: fetchSessions,
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSessions() {
  const context = useContext(ChatSessionContext);
  if (!context) {
    throw new Error("useChatSessions must be used within a ChatSessionProvider");
  }
  return context;
}
