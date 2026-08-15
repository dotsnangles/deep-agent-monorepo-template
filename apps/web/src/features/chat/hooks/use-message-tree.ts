"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { CreateChatMessageDTO, PatchChatLeafDTO, DeleteChatMessageDTO } from "@repo/validators";
import {
  type MessageNode,
  getBranchInfo,
  pruneSubtree,
  traverseActivePath,
  findDeepestDescendant,
} from "../lib/tree";
import { globalStreamManager } from "../lib/stream-manager";

async function saveMessageToDB(dto: CreateChatMessageDTO): Promise<boolean> {
  try {
    const res = await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    return res.ok;
  } catch (err) {
    console.error("[useMessageTree] Failed to save message:", err);
    return false;
  }
}

export function useMessageTree(sessionId: string) {
  const [allNodes, setAllNodes] = useState<MessageNode[]>([]);
  const [activeLeafId, setActiveLeafId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(() =>
    globalStreamManager.isSessionGenerating(sessionId)
  );

  // Compute the current active linear path based on allNodes and activeLeafId
  const activePath = useMemo(() => {
    return traverseActivePath(allNodes, activeLeafId);
  }, [allNodes, activeLeafId]);

  // Fetch full message tree on session change
  const fetchTree = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/chat/messages?sessionId=${encodeURIComponent(sessionId)}`);
      if (res.ok) {
        const data = await res.json();
        const messages: MessageNode[] = data.messages || [];
        setAllNodes(messages);
        setActiveLeafId(data.activeLeafId || null);

        // Check if there is an active stream in progress for this session to reconnect to
        const activeStream = globalStreamManager.getStreamState(sessionId);
        if (activeStream?.isGenerating && activeStream.assistantMessageId) {
          const assistantExists = messages.some((m) => m.id === activeStream.assistantMessageId);
          if (!assistantExists) {
            const reconnectedNode: MessageNode = {
              id: activeStream.assistantMessageId,
              sessionId,
              parentId: activeStream.userMessageId,
              role: "assistant",
              content: activeStream.content,
              createdAt: new Date(),
            };
            setAllNodes([...messages, reconnectedNode]);
          }
          setActiveLeafId(activeStream.assistantMessageId);
        }
      }
    } catch (err) {
      console.error("[useMessageTree] Failed to fetch message tree:", err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Subscribe to Global Stream Manager updates for real-time streaming & reconnection
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = globalStreamManager.subscribe(sessionId, (streamState) => {
      setIsGenerating(streamState.isGenerating);

      if (streamState.assistantMessageId) {
        setAllNodes((prev) => {
          const exists = prev.some((n) => n.id === streamState.assistantMessageId);
          if (exists) {
            return prev.map((n) =>
              n.id === streamState.assistantMessageId
                ? { ...n, content: streamState.content }
                : n
            );
          } else if (streamState.isGenerating) {
            // Re-attached or newly created stream node
            const newNode: MessageNode = {
              id: streamState.assistantMessageId,
              sessionId,
              parentId: streamState.userMessageId,
              role: "assistant",
              content: streamState.content,
              createdAt: new Date(),
            };
            return [...prev, newNode];
          }
          return prev;
        });

        if (streamState.isGenerating) {
          setActiveLeafId(streamState.assistantMessageId);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sessionId]);

  // Stop active AI generation
  const stopGeneration = useCallback(() => {
    globalStreamManager.stopStream(sessionId);
    toast.info("답변 생성을 중단했습니다.");
  }, [sessionId]);

  // Switch to a specific branch by message ID
  const switchBranch = useCallback(
    async (targetMessageId: string) => {
      const newLeafId = findDeepestDescendant(allNodes, targetMessageId);
      setActiveLeafId(newLeafId);

      // Persist active leaf to server
      try {
        const payload: PatchChatLeafDTO = { sessionId, activeLeafId: newLeafId };
        await fetch("/api/chat/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error("[useMessageTree] Failed to persist active leaf:", err);
      }
    },
    [allNodes, sessionId]
  );

  // Switch to next or previous sibling branch
  const navigateSibling = useCallback(
    (currentNodeId: string, direction: "prev" | "next") => {
      const info = getBranchInfo(currentNodeId, allNodes);
      if (info.totalBranches <= 1) return;

      const currIdx = info.currentIndex - 1; // 0-based
      const targetIdx =
        direction === "next"
          ? (currIdx + 1) % info.totalBranches
          : (currIdx - 1 + info.totalBranches) % info.totalBranches;

      const targetSiblingId = info.siblingIds[targetIdx];
      if (targetSiblingId) {
        switchBranch(targetSiblingId);
      }
    },
    [allNodes, switchBranch]
  );

  // Helper to execute agent response for a given active linear path
  const executeAgentStream = useCallback(
    async (userMsgNode: MessageNode, contextMessages: MessageNode[]) => {
      const assistantMessageId = crypto.randomUUID();

      // Create initial empty assistant placeholder node
      const placeholderAssistantNode: MessageNode = {
        id: assistantMessageId,
        sessionId,
        parentId: userMsgNode.id,
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };

      setAllNodes((prev) => [...prev, placeholderAssistantNode]);
      setActiveLeafId(assistantMessageId);

      const formattedContext = [
        ...contextMessages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
        { role: "user" as const, content: userMsgNode.content },
      ];

      // Delegate stream lifecycle to globalStreamManager (survives unmounts & switches)
      await globalStreamManager.startStream({
        sessionId,
        assistantMessageId,
        userMessageId: userMsgNode.id,
        contextMessages: formattedContext,
      });
    },
    [sessionId]
  );

  // Send a new message at the end of current active path
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isGenerating) return;

      const parentId = activePath.length > 0 ? activePath[activePath.length - 1].id : null;
      const userMessageId = crypto.randomUUID();

      const newUserNode: MessageNode = {
        id: userMessageId,
        sessionId,
        parentId,
        role: "user",
        content: content.trim(),
        createdAt: new Date(),
      };

      // Optimistically append user message
      setAllNodes((prev) => [...prev, newUserNode]);
      setActiveLeafId(userMessageId);

      // Persist user message to DB
      await saveMessageToDB({
        id: userMessageId,
        sessionId,
        parentId,
        role: "user",
        content: content.trim(),
      });

      // Execute AI generation with current active path as context
      await executeAgentStream(newUserNode, activePath);
    },
    [activePath, isGenerating, sessionId, executeAgentStream]
  );

  // Fork & Edit a previous user message
  const editUserMessage = useCallback(
    async (targetUserNodeId: string, newContent: string) => {
      if (!newContent.trim() || isGenerating) return;

      const targetNode = allNodes.find((n) => n.id === targetUserNodeId);
      if (!targetNode) return;

      const parentId = targetNode.parentId; // Fork at the same parent level
      const newUserNodeId = crypto.randomUUID();

      const newUserNode: MessageNode = {
        id: newUserNodeId,
        sessionId,
        parentId,
        role: "user",
        content: newContent.trim(),
        createdAt: new Date(),
      };

      // Compute ancestor context up to the parent
      const parentAncestors = parentId
        ? traverseActivePath(allNodes, parentId)
        : [];

      setAllNodes((prev) => [...prev, newUserNode]);
      setActiveLeafId(newUserNodeId);

      await saveMessageToDB({
        id: newUserNodeId,
        sessionId,
        parentId,
        role: "user",
        content: newContent.trim(),
      });

      // Execute agent response from the new forked point
      await executeAgentStream(newUserNode, parentAncestors);
    },
    [allNodes, isGenerating, sessionId, executeAgentStream]
  );

  // Regenerate an assistant response
  const regenerateAssistantMessage = useCallback(
    async (assistantNodeId: string) => {
      if (isGenerating) return;

      const assistantNode = allNodes.find((n) => n.id === assistantNodeId);
      if (!assistantNode || !assistantNode.parentId) return;

      const userParentNode = allNodes.find((n) => n.id === assistantNode.parentId);
      if (!userParentNode) return;

      const parentAncestors = userParentNode.parentId
        ? traverseActivePath(allNodes, userParentNode.parentId)
        : [];

      await executeAgentStream(userParentNode, parentAncestors);
    },
    [allNodes, isGenerating, executeAgentStream]
  );

  // Delete message node and all its descendants (Cascade Delete)
  const deleteMessage = useCallback(
    async (messageId: string) => {
      const targetNode = allNodes.find((n) => n.id === messageId);
      if (!targetNode) return;

      const { deletedIds, remainingNodes } = pruneSubtree(allNodes, messageId);

      // Optimistic update
      setAllNodes(remainingNodes);
      const newActive = traverseActivePath(remainingNodes, null);
      setActiveLeafId(newActive.length > 0 ? newActive[newActive.length - 1].id : null);

      try {
        const payload: DeleteChatMessageDTO = { sessionId, messageId };
        const res = await fetch("/api/chat/messages", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.activeLeafId !== undefined) {
            setActiveLeafId(data.activeLeafId);
          }
          toast.success(`메시지 ${deletedIds.length}개가 삭제되었습니다.`);
        }
      } catch (err) {
        console.error("[useMessageTree] Failed to delete message:", err);
        toast.error("메시지 삭제 중 오류가 발생했습니다.");
      }
    },
    [allNodes, sessionId]
  );

  return {
    allNodes,
    activePath,
    activeLeafId,
    isLoading,
    isGenerating,
    sendMessage,
    editUserMessage,
    regenerateAssistantMessage,
    deleteMessage,
    switchBranch,
    navigateSibling,
    stopGeneration,
    refetch: fetchTree,
  };
}
