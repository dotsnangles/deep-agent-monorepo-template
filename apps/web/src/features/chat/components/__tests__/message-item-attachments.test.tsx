import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { MessageItem } from "../message-item";
import type { MessageNode } from "../../lib/types";

describe("MessageItem Attachment Rendering", () => {
  it("renders image thumbnails and lightbox elements", () => {
    const mockMessage: MessageNode = {
      id: "msg-img",
      sessionId: "sess-1",
      parentId: null,
      role: "user",
      content: "Here is a screenshot",
      attachments: [
        {
          id: "att-1",
          name: "screenshot.png",
          url: "https://storage.local/screenshot.png",
          mimeType: "image/png",
          size: 10240,
          s3Key: "attachments/screenshot.png",
        },
      ],
      createdAt: new Date(),
    };

    const html = renderToString(
      <MessageItem
        message={mockMessage}
        isGenerating={false}
        onRegenerate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(html).toContain("screenshot.png");
    expect(html).toContain("https://storage.local/screenshot.png");
    expect(html).toContain("Here is a screenshot");
  });

  it("renders document attachment badges with download link", () => {
    const mockMessage: MessageNode = {
      id: "msg-doc",
      sessionId: "sess-1",
      parentId: null,
      role: "user",
      content: "Here is the PDF report",
      attachments: [
        {
          id: "att-doc-1",
          name: "quarterly_report.pdf",
          url: "https://storage.local/quarterly_report.pdf",
          mimeType: "application/pdf",
          size: 204800,
          s3Key: "attachments/quarterly_report.pdf",
        },
      ],
      createdAt: new Date(),
    };

    const html = renderToString(
      <MessageItem
        message={mockMessage}
        isGenerating={false}
        onRegenerate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(html).toContain("quarterly_report.pdf");
    expect(html).toContain("200.0 KB");
    expect(html).toContain("https://storage.local/quarterly_report.pdf");
    expect(html).toContain("download");
  });

  it("renders ReasoningCard for assistant message with reasoning trace", () => {
    const mockMessage: MessageNode = {
      id: "asst-reasoning-1",
      sessionId: "sess-1",
      parentId: "user-1",
      role: "assistant",
      content: "최종 분석 결과입니다.",
      reasoning: "단계별 사고 과정: 1. 입력 데이터 검증 2. 결과 도출",
      reasoningDuration: 4.2,
      createdAt: new Date(),
    };

    const html = renderToString(
      <MessageItem
        message={mockMessage}
        isGenerating={false}
        onRegenerate={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(html).toContain("data-testid=\"reasoning-card\"");
    expect(html).toContain("4.2초 동안 생각함");
    expect(html).toContain("최종 분석 결과입니다.");
  });
});
