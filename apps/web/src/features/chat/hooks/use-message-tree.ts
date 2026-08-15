"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  type MessageNode,
  getBranchInfo,
  pruneSubtree,
  traverseActivePath,
} from "../lib/tree";

export function useMessageTree(sessionId: string) {
  const [allNodes, setAllNodes] = useState<MessageNode[]>([]);
  const [activeLeafId, setActiveLeafId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

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
        setAllNodes(data.messages || []);
        setActiveLeafId(data.activeLeafId || null);
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

  // Switch to a specific branch by message ID
  const switchBranch = useCallback(
    async (targetMessageId: string) => {
      // Find deepest descendant of the target node
      let currId = targetMessageId;
      while (true) {
        const children = allNodes.filter((n) => n.parentId === currId);
        if (children.length === 0) break;
        children.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        currId = children[0].id;
      }

      const newLeafId = currId;
      setActiveLeafId(newLeafId);

      // Persist active leaf to server
      try {
        await fetch("/api/chat/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, activeLeafId: newLeafId }),
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
      setIsGenerating(true);
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

      try {
        // Send request with only active path context messages
        const response = await fetch("/api/copilotkit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-copilotkit-thread-id": sessionId,
          },
          body: JSON.stringify({
            messages: [
              ...contextMessages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              { role: "user", content: userMsgNode.content },
            ],
          }),
        });

        let assistantContent = "";
        if (response.ok && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let done = false;

          while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              // Simple extraction of raw text stream or json payload
              assistantContent += chunk;
              setAllNodes((prev) =>
                prev.map((n) =>
                  n.id === assistantMessageId ? { ...n, content: assistantContent } : n
                )
              );
            }
          }
        } else {
          assistantContent = "답변 생성에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
        }

        // Clean up any streaming protocol wrapping if present
        const cleanContent = assistantContent.trim() || "답변이 준비되었습니다.";

        // Persist final assistant node to DB
        await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: assistantMessageId,
            sessionId,
            parentId: userMsgNode.id,
            role: "assistant",
            content: cleanContent,
          }),
        });

        setAllNodes((prev) =>
          prev.map((n) => (n.id === assistantMessageId ? { ...n, content: cleanContent } : n))
        );
      } catch (error) {
        console.error("[useMessageTree] Stream error:", error);
        toast.error("에이전트 응답 수신 중 오류가 발생했습니다.");
      } finally {
        setIsGenerating(false);
      }
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
      try {
        await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: userMessageId,
            sessionId,
            parentId,
            role: "user",
            content: content.trim(),
          }),
        });
      } catch (err) {
        console.error("[useMessageTree] Failed to save user message:", err);
      }

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

      try {
        await fetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: newUserNodeId,
            sessionId,
            parentId,
            role: "user",
            content: newContent.trim(),
          }),
        });
      } catch (err) {
        console.error("[useMessageTree] Failed to save edited user message:", err);
      }

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
        const res = await fetch("/api/chat/messages", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, messageId }),
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
    refetch: fetchTree,
  };
}
