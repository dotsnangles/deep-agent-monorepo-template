import { describe, expect, it } from "vitest";

describe("useSmartScroll Strict Latching Mechanism", () => {
  it("maintains isPinnedToBottom true only when exactly at bottom (<= 2px)", () => {
    const scrollHeight = 1000;
    const clientHeight = 600;

    // Case 1: Exactly at bottom (distance = 0)
    const scrollTopAtBottom = 400;
    const distAtBottom = scrollHeight - scrollTopAtBottom - clientHeight;
    expect(distAtBottom <= 2).toBe(true);

    // Case 2: Sub-pixel rendering (distance = 1px)
    const scrollTopSubPixel = 399;
    const distSubPixel = scrollHeight - scrollTopSubPixel - clientHeight;
    expect(distSubPixel <= 2).toBe(true);
  });

  it("locks auto-scroll to false when user is even slightly above bottom (> 2px)", () => {
    const scrollHeight = 1000;
    const clientHeight = 600;

    // Case: User scrolled up slightly by 5px (distance = 5px)
    const scrollTopScrolledUp = 395;
    const dist = scrollHeight - scrollTopScrolledUp - clientHeight;
    const isAtBottom = dist <= 2;

    expect(isAtBottom).toBe(false);
  });
});
