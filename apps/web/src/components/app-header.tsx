"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Sparkles, Terminal } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Separator } from "@repo/ui/components/separator";
import { SidebarTrigger } from "@repo/ui/components/sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import UserMenu from "@/components/user-menu";

export function AppHeader() {
  const pathname = usePathname();
  const [health, setHealth] = React.useState<{
    status?: string;
    provider?: string;
  } | null>(null);

  React.useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/copilotkit/health");
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
        }
      } catch {
        // quiet fallback
      }
    }
    checkHealth();
  }, []);

  const getBreadcrumb = () => {
    if (pathname === "/") {
      return { section: "AI 에이전트", page: "플레이그라운드" };
    }
    if (pathname.startsWith("/dashboard")) {
      return { section: "플랫폼", page: "대시보드" };
    }
    if (pathname.startsWith("/login")) {
      return { section: "인증", page: "로그인" };
    }
    if (pathname.startsWith("/success")) {
      return { section: "인증", page: "완료" };
    }
    return { section: "Workspace", page: pathname.replace("/", "") };
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-4 backdrop-blur-xs">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-muted-foreground/80">{breadcrumb.section}</span>
          <ChevronRight className="size-3.5 opacity-50" />
          <span className="font-semibold text-foreground">{breadcrumb.page}</span>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Backend Badge */}
        <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span>{health?.provider ? `Agent: ${health.provider}` : "Agent Active"}</span>
        </div>

        <ModeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
