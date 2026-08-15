"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

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
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) || crypto.randomUUID();
    }
    return "default-session";
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { data: sessionData } = authClient.useSession();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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
      if (!silent) setIsLoading(false);
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

  // Check if current active session is a draft (not yet saved to DB)
  const isDraft = !sessions.some((s) => s.id === activeSessionId);

  const createNewSession = () => {
    // If not on main chat page, navigate to main chat page
    if (pathname !== "/") {
      router.push("/");
    }

    // If current session is already an unsaved draft, don't create unnecessary duplicate IDs
    if (isDraft) {
      toast.info("새로운 대화 준비 상태입니다.");
      return;
    }

    const newId = crypto.randomUUID();
    updateActiveSessionId(newId);
    toast.success("새로운 대화가 시작되었습니다.");
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
