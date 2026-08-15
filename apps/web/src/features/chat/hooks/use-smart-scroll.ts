"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSmartScrollOptions {
  threshold?: number;
}

export function useSmartScroll({ threshold = 60 }: UseSmartScrollOptions = {}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);
  const userScrolledUpRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const touchStartYRef = useRef(0);

  // Check scroll position and update button state
  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom <= threshold;

    setIsAtBottom(atBottom);
    setShowScrollBottomButton(!atBottom);

    // If user has naturally scrolled all the way to the bottom, re-enable auto-scroll
    if (atBottom && !isProgrammaticScrollRef.current) {
      userScrolledUpRef.current = false;
    }
  }, [threshold]);

  // Scroll to bottom (instant for streaming updates, smooth for explicit button clicks)
  const scrollToBottom = useCallback((behavior: "smooth" | "instant" | "auto" = "instant") => {
    const el = scrollRef.current;
    if (!el) return;

    isProgrammaticScrollRef.current = true;
    userScrolledUpRef.current = false;
    setIsAtBottom(true);
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
      }, 250);
    }
  }, []);

  // Zero-latency listener for wheel & touch gestures to immediately break auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // User is scrolling UP -> instantly lock auto-scroll with 0ms latency
      if (e.deltaY < 0) {
        userScrolledUpRef.current = true;
        setIsAtBottom(false);
        setShowScrollBottomButton(true);
      } else if (e.deltaY > 0) {
        // User scrolling down: check if they reached bottom
        const dist = el.scrollHeight - (el.scrollTop + e.deltaY) - el.clientHeight;
        if (dist <= threshold) {
          userScrolledUpRef.current = false;
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
        // Dragging down finger = scrolling UP content
        if (currentY - touchStartYRef.current > 5) {
          userScrolledUpRef.current = true;
          setIsAtBottom(false);
          setShowScrollBottomButton(true);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["PageUp", "ArrowUp", "Home"].includes(e.key)) {
        userScrolledUpRef.current = true;
        setIsAtBottom(false);
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
  }, [threshold]);

  const handleScroll = useCallback(() => {
    checkScrollPosition();
  }, [checkScrollPosition]);

  return {
    scrollRef,
    isAtBottom,
    showScrollBottomButton,
    userScrolledUpRef,
    scrollToBottom,
    handleScroll,
    checkScrollPosition,
  };
}
