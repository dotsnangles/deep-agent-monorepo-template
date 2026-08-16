import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { InteractiveChartImage } from "../interactive-chart-image";

describe("InteractiveChartImage Unit Tests", () => {
  it("renders chart thumbnail image and caption", () => {
    const html = renderToString(
      <InteractiveChartImage
        src="/sessions/s123/artifacts/chart.png"
        alt="월별 매출 추이"
      />
    );

    expect(html).toContain("data-testid=\"interactive-chart-card\"");
    expect(html).toContain("/sessions/s123/artifacts/chart.png");
    expect(html).toContain("월별 매출 추이");
    expect(html).toContain("크게 보기");
  });

  it("renders durable S3 presigned url in thumbnail card", () => {
    const s3Url = "https://s3.ap-northeast-2.amazonaws.com/bucket/artifacts/sessions/sess-1/growth.png?X-Amz-Signature=abc";
    const html = renderToString(
      <InteractiveChartImage
        src={s3Url}
        alt="연간 성장률 분석 그래프"
      />
    );

    expect(html).toContain(s3Url);
    expect(html).toContain("연간 성장률 분석 그래프");
  });
});
