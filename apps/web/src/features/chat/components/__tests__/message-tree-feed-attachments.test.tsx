import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MessageTreeFeed } from "../message-tree-feed";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock hooks
vi.mock("../../hooks/use-chat-engine", () => ({
  useChatEngine: vi.fn().mockReturnValue({
    activePath: [],
    isLoading: false,
    isGenerating: false,
    generatingAssistantId: null,
    send: vi.fn(),
    respondToApproval: vi.fn(),
    forkAndEdit: vi.fn(),
    regenerate: vi.fn(),
    deleteNode: vi.fn(),
    selectBranch: vi.fn(),
    retry: vi.fn(),
    stop: vi.fn(),
    getBranchInfo: vi.fn().mockReturnValue({ currentIndex: 1, totalBranches: 1 }),
  }),
}));

vi.mock("../../hooks/use-smart-scroll", () => ({
  useSmartScroll: vi.fn().mockReturnValue({
    scrollRef: { current: null },
    showScrollBottomButton: false,
    isPinnedToBottomRef: { current: true },
    scrollToBottom: vi.fn(),
    handleScroll: vi.fn(),
  }),
}));

vi.mock("../../hooks/use-direct-upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../hooks/use-direct-upload")>();
  return {
    ...actual,
    useDirectUpload: vi.fn().mockReturnValue({
      stagedFiles: [
        {
          id: "staged-1",
          file: new File([""], "spec.pdf", { type: "application/pdf" }),
          name: "spec.pdf",
          size: 102400,
          mimeType: "application/pdf",
          progress: 100,
          status: "complete",
          entity: {
            id: "att_1",
            name: "spec.pdf",
            url: "https://storage.local/spec.pdf",
            mimeType: "application/pdf",
            size: 102400,
            s3Key: "attachments/spec.pdf",
          },
        },
      ],
      isUploading: false,
      completedAttachments: [
        {
          id: "att_1",
          name: "spec.pdf",
          url: "https://storage.local/spec.pdf",
          mimeType: "application/pdf",
          size: 102400,
          s3Key: "attachments/spec.pdf",
        },
      ],
      addFiles: vi.fn(),
      removeFile: vi.fn(),
      clearStaged: vi.fn(),
    }),
  };
});

describe("MessageTreeFeed Attachments Integration", () => {
  it("renders paperclip attachment button and staged file chips in prompt box", () => {
    const html = renderToString(<MessageTreeFeed sessionId="session-upload-test" />);

    // File input & paperclip button
    expect(html).toContain("type=\"file\"");
    expect(html).toContain("파일 첨부 (이미지, PDF, TXT, CSV, JSON, MD)");

    // Staged files bar
    expect(html).toContain("spec.pdf");
    expect(html).toContain("100.0 KB");
  });
});
