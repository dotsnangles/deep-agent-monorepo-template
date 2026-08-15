"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { globalStreamManager } from "../lib/stream-manager";

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatSessionContextType {
  sessions: ChatSession[];
  activeSessionId: string;
  isLoading: boolean;
  isDraft: boolean;
  isSearchOpen: boolean;
  generatingSessionIds: string[];
  isSessionGenerating: (id: string) => boolean;
  setIsSearchOpen: (open: boolean) => void;
  openSearch: () => void;
  closeSearch: () => void;
  createNewSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, newTitle: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

const ChatSessionContext = createContext<ChatSessionContextType | null>(null);

const STORAGE_KEY = "hollow_echo_active_thread_id";

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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [generatingSessionIds, setGeneratingSessionIds] = useState<string[]>(() =>
    globalStreamManager.getGeneratingSessionIds()
  );
  const { data: sessionData } = authClient.useSession();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to global stream updates for sidebar/UI indicators
  useEffect(() => {
    return globalStreamManager.subscribeGlobal(() => {
      setGeneratingSessionIds(globalStreamManager.getGeneratingSessionIds());
    });
  }, []);

  const isSessionGenerating = useCallback(
    (id: string) => generatingSessionIds.includes(id),
    [generatingSessionIds]
  );

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

  const fetchSessions = useCallback(async (silent = false) => {
    if (!sessionData?.user) {
      setIsLoading(false);
      return;
    }
    try {
      if (!silent) setIsLoading(true);
      const res = await fetch("/api/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        const fetchedSessions: ChatSession[] = data.sessions || [];
        setSessions(fetchedSessions);
      }
    } catch (error) {
      console.error("Failed to fetch chat sessions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionData?.user]);

  // Initial fetch and periodic background sync to detect when a draft session gets saved
  useEffect(() => {
    fetchSessions();

    pollingRef.current = setInterval(() => {
      fetchSessions(true);
    }, 4000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchSessions]);

  // Optimistically add session to local list
  const optimisticAddSession = useCallback(
    (id: string, title = "새로운 대화") => {
      setSessions((prev) => {
        if (prev.some((s) => s.id === id)) return prev;
        const newSession: ChatSession = {
          id,
          userId: sessionData?.user?.id || "guest",
          title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return [newSession, ...prev];
      });
    },
    [sessionData?.user?.id]
  );

  // Auto-detect when user sends a message in a draft session and immediately add to list
  useEffect(() => {
    const handleUserInteraction = (e: KeyboardEvent | MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (e instanceof KeyboardEvent && e.key === "Enter" && !e.shiftKey) {
        // Only trigger if inside a textarea or text input with non-empty content
        if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
          // Ignore search dialog / filter inputs
          if (target.placeholder?.includes("검색") || target.closest("[role=dialog]")) {
            return;
          }
          const text = target.value?.trim();
          if (text && text.length > 0) {
            if (!sessions.some((s) => s.id === activeSessionId)) {
              const snippet = text.length > 30 ? text.slice(0, 30) + "..." : text;
              optimisticAddSession(activeSessionId, snippet);
              setTimeout(() => fetchSessions(true), 1500);
            }
          }
        }
      } else if (e instanceof MouseEvent) {
        const sendBtn = target.closest("button[type=submit], .copilotKitSendButton, [data-copilotkit-send]");
        if (sendBtn) {
          const formOrContainer = sendBtn.closest("form, .copilotKitInput, div");
          const textarea = formOrContainer?.querySelector("textarea, input") as HTMLTextAreaElement | HTMLInputElement | null;
          const text = textarea?.value?.trim();
          if (text && text.length > 0) {
            if (!sessions.some((s) => s.id === activeSessionId)) {
              const snippet = text.length > 30 ? text.slice(0, 30) + "..." : text;
              optimisticAddSession(activeSessionId, snippet);
              setTimeout(() => fetchSessions(true), 1500);
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleUserInteraction, true);
    window.addEventListener("click", handleUserInteraction, true);
    return () => {
      window.removeEventListener("keydown", handleUserInteraction, true);
      window.removeEventListener("click", handleUserInteraction, true);
    };
  }, [activeSessionId, sessions, optimisticAddSession, fetchSessions]);

  const isDraft = !sessions.some((s) => s.id === activeSessionId);

  const createNewSession = () => {
    // If not on main chat page, navigate to main chat page
    if (pathname !== "/") {
      router.push("/");
    }

    const newId = crypto.randomUUID();
    updateActiveSessionId(newId);
  };

  const switchSession = (id: string) => {
    updateActiveSessionId(id);
    // If user is on /dashboard or other pages, route to main chat playground
    if (pathname !== "/") {
      router.push("/");
    }
  };

  const deleteSession = async (id: string) => {
    if (sessionData?.user) {
      try {
        const res = await fetch(`/api/chat/sessions/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Delete failed");
      } catch (error) {
        console.error("Failed to delete session:", error);
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
        console.error("Failed to rename session:", error);
        toast.error("세션 이름 변경에 실패했습니다.");
        return;
      }
    }

    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s))
    );
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
