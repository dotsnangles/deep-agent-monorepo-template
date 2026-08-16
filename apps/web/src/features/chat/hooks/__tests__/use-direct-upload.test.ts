import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatFileSize, isImageMime } from "../use-direct-upload";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from "@repo/validators";

describe("Direct Upload Validation & Formatting Utilities", () => {
  it("formats file sizes cleanly across byte, kilobyte, and megabyte tiers", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1024 * 1024 * 14.5)).toBe("14.5 MB");
  });

  it("correctly checks if MIME type is an image", () => {
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/jpeg")).toBe(true);
    expect(isImageMime("image/webp")).toBe(true);
    expect(isImageMime("image/gif")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime("text/plain")).toBe(false);
    expect(isImageMime("text/csv")).toBe(false);
  });

  it("enforces allowed attachment MIME types and limits", () => {
    expect(ALLOWED_ATTACHMENT_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_ATTACHMENT_MIME_TYPES).toContain("application/pdf");
    expect(ALLOWED_ATTACHMENT_MIME_TYPES).toContain("text/markdown");
    expect(ALLOWED_ATTACHMENT_MIME_TYPES).toContain("text/csv");
    expect(ALLOWED_ATTACHMENT_MIME_TYPES).toContain("application/json");

    expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_ATTACHMENTS_PER_MESSAGE).toBe(5);
  });
});
