export {
  ChatSessionProvider,
  useChatSessions,
  type ChatSession,
} from "./context/chat-session-context";
export { ChatSearchDialog } from "./components/chat-search-dialog";
export { MessageFeed, MessageTreeFeed } from "./components/message-feed";
export { MessageItem } from "./components/message-item";
export { MarkdownRenderer } from "./components/markdown-renderer";
export { ToolActionCard } from "./components/tool-action-card";
export { TodoPlanCard } from "./components/todo-plan-card";
export { SpecialistDelegationCard } from "./components/specialist-delegation-card";
export { InteractiveChartImage } from "./components/interactive-chart-image";
export { AttachmentStagingBar } from "./components/attachment-staging-bar";
export { ArtifactSidebar } from "./components/artifact-sidebar";
export {
  useChatEngine,
  useChatRegistry,
  type UseChatEngineReturn,
} from "./hooks/use-chat-engine";
export { useSmartScroll } from "./hooks/use-smart-scroll";
export { useCopyToClipboard } from "./hooks/use-copy-to-clipboard";
export {
  useDirectUpload,
  formatFileSize,
  isImageMime,
  getAttachmentFileIcon,
  type StagedAttachment,
  type UseDirectUploadOptions,
} from "./hooks/use-direct-upload";

export * from "./lib/types";
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
