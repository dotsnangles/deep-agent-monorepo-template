import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { TodoPlanCard } from "../todo-plan-card";
import type { TodoItem } from "../../lib/types";

describe("TodoPlanCard Unit Tests", () => {
  it("returns null when todos list is empty", () => {
    const html = renderToString(<TodoPlanCard todos={[]} />);
    expect(html).toBe("");
  });

  it("renders checklist with pending, in_progress, and completed items", () => {
    const todos: TodoItem[] = [
      { id: "1", content: "1단계: 데이터 로드", status: "completed" },
      { id: "2", content: "2단계: 통계 분석 수행", status: "in_progress" },
      { id: "3", content: "3단계: 시각화 차트 렌더링", status: "pending" },
    ];

    const html = renderToString(<TodoPlanCard todos={todos} isGenerating={true} />);
    expect(html).toContain("작업 계획");
    expect(html).toContain("1/3 완료");
    expect(html).toContain("1단계: 데이터 로드");
    expect(html).toContain("2단계: 통계 분석 수행");
    expect(html).toContain("3단계: 시각화 차트 렌더링");
    expect(html).toContain("line-through");
  });
});
