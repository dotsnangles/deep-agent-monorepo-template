"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useSmartScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);

  // Master Latch: true when locked to bottom, false the instant user scrolls up by even 1px
  const isPinnedToBottomRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const touchStartYRef = useRef(0);

  // Strict scroll position check with zero threshold ambiguity
  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    // Show floating return button if scrolled up by more than 20px
    setShowScrollBottomButton(distanceFromBottom > 20);

    // Auto-scroll is ONLY re-enabled when the user reaches the absolute bottom (<= 2px)
    if (distanceFromBottom <= 2) {
      isPinnedToBottomRef.current = true;
    } else if (!isProgrammaticScrollRef.current) {
      // If user is anywhere above the bottom, latch auto-scroll to false
      isPinnedToBottomRef.current = false;
    }
  }, []);

  // Scroll to bottom helper
  const scrollToBottom = useCallback((behavior: "smooth" | "instant" | "auto" = "instant") => {
    const el = scrollRef.current;
    if (!el) return;

    isProgrammaticScrollRef.current = true;
    isPinnedToBottomRef.current = true;
    setShowScrollBottomButton(false);

    if (behavior === "instant" || behavior === "auto") {
      el.scrollTop = el.scrollHeight;
      isProgrammaticScrollRef.current = false;
    } else {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: "smooth",
      });
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 300);
    }
  }, []);

  // Zero-latency event listeners for wheel, touch, and keyboard
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Any upward wheel tick immediately latches auto-scroll OFF with 0ms delay
      if (e.deltaY < 0) {
        isPinnedToBottomRef.current = false;
        setShowScrollBottomButton(true);
      } else if (e.deltaY > 0) {
        // Downward wheel: re-enable auto-scroll only if reaching the very bottom
        const dist = el.scrollHeight - (el.scrollTop + e.deltaY) - el.clientHeight;
        if (dist <= 2) {
          isPinnedToBottomRef.current = true;
          setShowScrollBottomButton(false);
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartYRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const currentY = e.touches[0].clientY;
        // Dragging finger downward moves content upward
        if (currentY - touchStartYRef.current > 3) {
          isPinnedToBottomRef.current = false;
          setShowScrollBottomButton(true);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["PageUp", "ArrowUp", "Home"].includes(e.key)) {
        isPinnedToBottomRef.current = false;
        setShowScrollBottomButton(true);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: true });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: true });
    el.addEventListener("keydown", handleKeyDown, { passive: true });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleScroll = useCallback(() => {
    checkScrollPosition();
  }, [checkScrollPosition]);

  return {
    scrollRef,
    showScrollBottomButton,
    isPinnedToBottomRef,
    scrollToBottom,
    handleScroll,
    checkScrollPosition,
  };
}
