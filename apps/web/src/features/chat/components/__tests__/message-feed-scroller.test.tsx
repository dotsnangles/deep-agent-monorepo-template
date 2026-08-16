import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MessageFeed } from "../message-feed";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../../hooks/use-chat-engine", () => ({
  useChatEngine: vi.fn().mockReturnValue({
    activePath: [
      {
        id: "msg-user-1",
        role: "user",
        content: "안녕하세요, 피보나치 수열 알고리즘 알려줘",
        timestamp: Date.now(),
      },
      {
        id: "msg-assistant-1",
        role: "assistant",
        content: "피보나치 수열 파이썬 구현 코드입니다.",
        timestamp: Date.now(),
      },
    ],
    isLoading: false,
    isGenerating: false,
    generatingAssistantId: null,
    send: vi.fn(),
    respondToApproval: vi.fn(),
    regenerate: vi.fn(),
    deleteNode: vi.fn(),
    retry: vi.fn(),
    forkSession: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("../../hooks/use-smart-scroll", () => ({
  useSmartScroll: vi.fn().mockReturnValue({
    scrollRef: { current: null },
    showScrollBottomButton: true,
    isPinnedToBottomRef: { current: true },
    scrollToBottom: vi.fn(),
    handleScroll: vi.fn(),
  }),
}));

vi.mock("../../hooks/use-direct-upload", () => ({
  useDirectUpload: vi.fn().mockReturnValue({
    stagedFiles: [],
    isUploading: false,
    completedAttachments: [],
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    clearStaged: vi.fn(),
  }),
}));

describe("MessageFeed with shadcn MessageScroller & Chat Primitives", () => {
  it("renders with shadcn MessageScroller data-slots and message turns", () => {
    const html = renderToString(<MessageFeed sessionId="session-scroller-test" />);

    // Check shadcn MessageScroller slots
    expect(html).toContain('data-slot="message-scroller"');
    expect(html).toContain('data-slot="message-scroller-viewport"');
    expect(html).toContain('data-slot="message-scroller-content"');

    // Check message content
    expect(html).toContain("안녕하세요, 피보나치 수열 알고리즘 알려줘");
    expect(html).toContain("피보나치 수열 파이썬 구현 코드입니다.");

    // Check scroll bottom button slot
    expect(html).toContain("최신 메시지 보기");
  });
});
