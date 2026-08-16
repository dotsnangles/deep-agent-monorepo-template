import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { AttachmentStagingBar } from "../attachment-staging-bar";
import type { StagedAttachment } from "../../hooks/use-direct-upload";

describe("AttachmentStagingBar Component", () => {
  it("renders nothing when stagedFiles is empty", () => {
    const html = renderToString(
      <AttachmentStagingBar stagedFiles={[]} onRemove={vi.fn()} />
    );
    expect(html).toBe("");
  });

  it("renders image preview and document chips with progress and remove button", () => {
    const mockFiles: StagedAttachment[] = [
      {
        id: "f1",
        file: new File([""], "image.png", { type: "image/png" }),
        name: "image.png",
        size: 2048,
        mimeType: "image/png",
        previewUrl: "blob:http://localhost/image.png",
        progress: 50,
        status: "uploading",
      },
      {
        id: "f2",
        file: new File([""], "data.csv", { type: "text/csv" }),
        name: "data.csv",
        size: 4096,
        mimeType: "text/csv",
        progress: 100,
        status: "complete",
      },
    ];

    const html = renderToString(
      <AttachmentStagingBar stagedFiles={mockFiles} onRemove={vi.fn()} />
    );

    expect(html).toContain("image.png");
    expect(html).toContain("50%");
    expect(html).toContain("data.csv");
    expect(html).toContain("4.0 KB");
    expect(html).toContain("파일 첨부 취소");
  });
});
