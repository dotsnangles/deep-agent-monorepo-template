export {
  ChatSessionProvider,
  useChatSessions,
  type ChatSession,
} from "./context/chat-session-context";
export { ChatSearchDialog } from "./components/chat-search-dialog";
export { MessageTreeFeed } from "./components/message-tree-feed";
export { MessageItem } from "./components/message-item";
export { MessageBranchSwitcher } from "./components/message-branch-switcher";
export { MarkdownRenderer } from "./components/markdown-renderer";
export {
  useChatEngine,
  useChatRegistry,
  type UseChatEngineReturn,
} from "./hooks/use-chat-engine";
export { useSmartScroll } from "./hooks/use-smart-scroll";
export { useCopyToClipboard } from "./hooks/use-copy-to-clipboard";

export {
  traverseActivePath,
  getBranchInfo,
  pruneSubtree,
  type MessageNode,
  type BranchInfo,
} from "./lib/tree";
export {
  fuzzyMatch,
  type FuzzySegment,
  type FuzzyMatchResult,
} from "./lib/fuzzy-match";
export {
  deriveSessionTitle,
  DEFAULT_SESSION_TITLE,
  MAX_DERIVED_TITLE_LENGTH,
} from "./lib/session-title";
export * from "./engine";
