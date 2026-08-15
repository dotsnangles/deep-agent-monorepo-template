"use client";

import { useSyncExternalStore, useEffect, useCallback, useMemo, useRef } from "react";
import { globalChatEngineRegistry } from "../engine";
import type { ChatEngine, ChatEngineState, ChatEngineOptions } from "../engine";
import type { BranchInfo } from "../lib/tree";

export interface UseChatEngineReturn extends ChatEngineState {
  engine: ChatEngine;
  send: (content: string, titleSnippet?: string) => Promise<void>;
  forkAndEdit: (nodeId: string, content: string) => Promise<void>;
  regenerate: (nodeId: string) => Promise<void>;
  selectBranch: (nodeId: string, direction: "prev" | "next") => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  retry: (nodeId?: string) => Promise<void>;
  stop: () => void;
  getBranchInfo: (nodeId: string) => BranchInfo;
}

export function useChatEngine(
  sessionId: string,
  options?: Omit<ChatEngineOptions, "sessionId">
): UseChatEngineReturn {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const engine = useMemo(() => {
    return globalChatEngineRegistry.getEngine(sessionId, optionsRef.current);
  }, [sessionId]);

  const state = useSyncExternalStore<ChatEngineState>(
    useCallback((onStoreChange) => engine.subscribe(onStoreChange), [engine]),
    useCallback(() => engine.getState(), [engine]),
    useCallback(() => engine.getState(), [engine])
  );

  useEffect(() => {
    if (sessionId && state.allNodes.length === 0 && !state.isGenerating) {
      engine.loadTree();
    }
  }, [sessionId, engine, state.allNodes.length, state.isGenerating]);

  const send = useCallback(
    (content: string, titleSnippet?: string) => engine.send(content, titleSnippet),
    [engine]
  );

  const forkAndEdit = useCallback(
    (nodeId: string, content: string) => engine.forkAndEdit(nodeId, content),
    [engine]
  );

  const regenerate = useCallback(
    (nodeId: string) => engine.regenerate(nodeId),
    [engine]
  );

  const selectBranch = useCallback(
    (nodeId: string, direction: "prev" | "next") => engine.selectBranch(nodeId, direction),
    [engine]
  );

  const deleteNode = useCallback(
    (nodeId: string) => engine.deleteNode(nodeId),
    [engine]
  );

  const retry = useCallback(
    (nodeId?: string) => engine.retry(nodeId),
    [engine]
  );

  const stop = useCallback(() => engine.stop(), [engine]);

  const getBranchInfo = useCallback(
    (nodeId: string) => engine.getBranchInfo(nodeId),
    [engine]
  );

  return {
    engine,
    ...state,
    send,
    forkAndEdit,
    regenerate,
    selectBranch,
    deleteNode,
    retry,
    stop,
    getBranchInfo,
  };
}

export function useChatRegistry() {
  const registry = globalChatEngineRegistry;

  const generatingSessionIds = useSyncExternalStore<string[]>(
    useCallback((onStoreChange) => registry.subscribe(() => onStoreChange()), [registry]),
    useCallback(() => registry.getGeneratingSessionIds(), [registry]),
    useCallback(() => [], [])
  );

  return {
    registry,
    generatingSessionIds,
    isSessionGenerating: useCallback(
      (sessionId: string) => registry.isSessionGenerating(sessionId),
      [registry]
    ),
  };
}
