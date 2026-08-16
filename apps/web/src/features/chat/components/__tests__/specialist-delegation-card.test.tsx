import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { SpecialistDelegationCard } from "../specialist-delegation-card";
import type { SubagentExecution } from "../../lib/types";

describe("SpecialistDelegationCard Unit Tests", () => {
  it("returns null when subagents list is empty", () => {
    const html = renderToString(<SpecialistDelegationCard subagents={[]} />);
    expect(html).toBe("");
  });

  it("renders specialist cards with role metadata, status badges, and output", () => {
    const subagents: SubagentExecution[] = [
      {
        subagent: "data_analyst",
        task: "데이터셋 결측치 및 이상치 분석",
        status: "completed",
        output: { rows: 1000, nullCount: 0 },
      },
      {
        subagent: "chart_generator",
        task: "월별 매출 동향 인터랙티브 차트 생성",
        status: "running",
      },
    ];

    const html = renderToString(<SpecialistDelegationCard subagents={subagents} />);
    expect(html).toContain("데이터 분석가");
    expect(html).toContain("시각화 / 차트 생성기");
    expect(html).toContain("데이터셋 결측치 및 이상치 분석");
    expect(html).toContain("월별 매출 동향 인터랙티브 차트 생성");
    expect(html).toContain("완료");
    expect(html).toContain("실행 중");
    expect(html).toContain("rows");
  });
});
