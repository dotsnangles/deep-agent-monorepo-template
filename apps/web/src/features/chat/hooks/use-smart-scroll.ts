"use client";

import { useCallback, useRef, useState } from "react";

interface UseSmartScrollOptions {
  threshold?: number;
}

export function useSmartScroll({ threshold = 80 }: UseSmartScrollOptions = {}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);
  const isAutoScrollingRef = useRef(false);
  const userScrolledUpRef = useRef(false);

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom <= threshold;

    setIsAtBottom(atBottom);
    setShowScrollBottomButton(!atBottom);

    if (atBottom) {
      userScrolledUpRef.current = false;
    } else if (!isAutoScrollingRef.current) {
      userScrolledUpRef.current = true;
    }
  }, [threshold]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;

    isAutoScrollingRef.current = true;
    userScrolledUpRef.current = false;
    setIsAtBottom(true);
    setShowScrollBottomButton(false);

    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });

    setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 350);
  }, []);

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
