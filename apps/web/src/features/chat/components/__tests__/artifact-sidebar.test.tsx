import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ArtifactListPanel } from "../artifact-sidebar";

describe("ArtifactListPanel Component Tests", () => {
  it("renders empty state when there are no artifacts", () => {
    const html = renderToString(
      <ArtifactListPanel
        sessionId="sess-empty"
        artifacts={[]}
        attachments={[]}
      />
    );

    expect(html).toContain("Files");
    expect(html).toContain("Created");
    expect(html).toContain("아직 생성된 산출물이 없습니다.");
    expect(html).toContain("Added");
    expect(html).toContain("첨부된 파일이 없습니다.");
  });

  it("renders artifact list and user attachments with file names, sizes, and download links", () => {
    const mockArtifacts = [
      {
        id: "art-1",
        sessionId: "sess-1",
        messageId: "msg-1",
        name: "sales_chart.png",
        storageKey: "artifacts/sessions/sess-1/sales_chart.png",
        mimeType: "image/png",
        sizeBytes: 1048576, // 1 MB
        metadata: {},
        createdAt: new Date("2026-08-17T10:00:00Z"),
      },
      {
        id: "art-2",
        sessionId: "sess-1",
        messageId: "msg-2",
        name: "data_report.csv",
        storageKey: "artifacts/sessions/sess-1/data_report.csv",
        mimeType: "text/csv",
        sizeBytes: 2048, // 2 KB
        metadata: {},
        createdAt: new Date("2026-08-17T10:05:00Z"),
      },
    ];

    const mockAttachments = [
      {
        id: "att-1",
        name: "specification.pdf",
        url: "https://storage.example.com/attachments/spec.pdf",
        s3Key: "attachments/spec.pdf",
        mimeType: "application/pdf",
        size: 524288, // 512 KB
      },
    ];

    const html = renderToString(
      <ArtifactListPanel
        sessionId="sess-1"
        artifacts={mockArtifacts}
        attachments={mockAttachments}
      />
    );

    expect(html).toContain("Files");
    expect(html).toContain("3"); // Total count badge (2 artifacts + 1 attachment)
    expect(html).toContain("Created");
    expect(html).toContain("sales_chart.png");
    expect(html).toContain("data_report.csv");
    expect(html).toContain("1 MB");
    expect(html).toContain("2 KB");
    expect(html).toContain("/api/chat/sessions/sess-1/artifacts/sales_chart.png");
    expect(html).toContain("/api/chat/sessions/sess-1/artifacts/data_report.csv");

    expect(html).toContain("Added");
    expect(html).toContain("specification.pdf");
    expect(html).toContain("512 KB");
  });
});
