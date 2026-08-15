"use client";

import { useState } from "react";
import { toast } from "sonner";

export function useCopyToClipboard(successMessage = "클립보드에 복사되었습니다.") {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      toast.error("복사에 실패했습니다.");
      return false;
    }
  };

  return { copied, copy };
}
