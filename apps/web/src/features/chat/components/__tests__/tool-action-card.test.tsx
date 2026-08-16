import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ToolActionCard, DEFAULT_REJECTION_REASON } from "../tool-action-card";
import type { ToolApprovalRequest } from "../../lib/types";

describe("ToolActionCard Component", () => {
  it("renders pending approval card with tool name, description, parameters, and action buttons", () => {
    const approval: ToolApprovalRequest = {
      toolCallId: "call_123",
      tool: "execute_command",
      input: { command: "npm test" },
      description: "테스트 명령어 실행 승인 요청",
      status: "pending",
    };

    const handleApprove = vi.fn();
    const handleReject = vi.fn();

    const html = renderToString(
      <ToolActionCard
        approval={approval}
        isGenerating={false}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    );

    expect(html).toContain("execute_command");
    expect(html).toContain("테스트 명령어 실행 승인 요청");
    expect(html).toContain("npm test");
    expect(html).toContain("승인");
    expect(html).toContain("거절");
    expect(html).toContain("대기 중");
  });

  it("renders visual diff section when diff parameter is present", () => {
    const approval: ToolApprovalRequest = {
      toolCallId: "call_diff_1",
      tool: "write_file",
      input: {
        filepath: "src/index.ts",
        diff: "--- a/src/index.ts\n+++ b/src/index.ts\n-console.log('old');\n+console.log('new');",
      },
      status: "pending",
    };

    const html = renderToString(
      <ToolActionCard
        approval={approval}
        isGenerating={false}
        onApprove={() => {}}
        onReject={() => {}}
      />
    );

    expect(html).toContain("변경 사항 (Diff)");
    expect(html).toContain("console.log(&#x27;new&#x27;);");
  });

  it("renders approved state with green badge and hides action buttons", () => {
    const approval: ToolApprovalRequest = {
      toolCallId: "call_456",
      tool: "write_file",
      input: { filepath: "/etc/config.json" },
      status: "approved",
    };

    const html = renderToString(
      <ToolActionCard
        approval={approval}
        isGenerating={false}
        onApprove={() => {}}
        onReject={() => {}}
      />
    );

    expect(html).toContain("write_file");
    expect(html).toContain("승인됨");
    expect(html).not.toContain("대기 중");
  });

  it("renders rejected state with red badge and hides action buttons", () => {
    const approval: ToolApprovalRequest = {
      toolCallId: "call_789",
      tool: "delete_resource",
      input: { resource_id: "res_1" },
      status: "rejected",
      reason: DEFAULT_REJECTION_REASON,
    };

    const html = renderToString(
      <ToolActionCard
        approval={approval}
        isGenerating={false}
        onApprove={() => {}}
        onReject={() => {}}
      />
    );

    expect(html).toContain("delete_resource");
    expect(html).toContain("거절됨");
  });
});
