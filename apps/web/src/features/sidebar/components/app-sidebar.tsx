"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Check,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@repo/ui/components/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { NavUser } from "@/features/auth";
import { useChatSessions } from "@/features/chat";

const PAGE_SIZE = 25;

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const sentinelRef = React.useRef<HTMLLIElement>(null);

  const {
    sessions,
    activeSessionId,
    createNewSession,
    switchSession,
    deleteSession,
    renameSession,
    openSearch,
    isLoading,
    isDraft,
    isSessionGenerating,
  } = useChatSessions();

  // Seamless lazy loading: load next batch instantly as user approaches bottom
  React.useEffect(() => {
    if (visibleCount >= sessions.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sessions.length));
        }
      },
      { threshold: 0, rootMargin: "200px" }
    );

    const target = sentinelRef.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [visibleCount, sessions.length]);

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingSessionId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveRename = async (id: string) => {
    if (editTitle.trim()) {
      await renameSession(id, editTitle.trim());
    }
    setEditingSessionId(null);
  };

  const displayedSessions = sessions.slice(0, visibleCount);
  const hasMore = visibleCount < sessions.length;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" {...props}>
      {/* Workspace / Brand Header (Only Brand Identity & Sidebar Toggle) */}
      <SidebarHeader className="shrink-0 pt-4 pb-1 px-3 group-data-[collapsible=icon]:pt-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pb-1">
        {/* App Identity / Brand Row & Sidebar Toggle */}
        <div className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          {/* Expanded Mode: Brand Logo + Name */}
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg hover:opacity-85 transition-opacity group-data-[collapsible=icon]:hidden"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs shrink-0">
              <Bot className="size-4.5" />
            </div>
            <div className="grid flex-1 text-left text-xs leading-tight">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <span>Hollow Echo</span>
                <Badge variant="outline" className="h-3.5 px-1 text-[9px] font-mono leading-none">
                  v1.0
                </Badge>
              </div>
              <span className="truncate text-[11px] text-muted-foreground">
                Deep Agent Platform
              </span>
            </div>
          </Link>

          {/* Expanded Mode: Collapse Button */}
          <div className="group-data-[collapsible=icon]:hidden">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleSidebar}
                    className="size-8 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg shrink-0"
                  />
                }
              >
                <PanelLeft className="size-4" />
                <span className="sr-only">사이드바 접기</span>
              </TooltipTrigger>
              <TooltipContent side="right">사이드바 접기</TooltipContent>
            </Tooltip>
          </div>

          {/* Collapsed Mode: App Logo by default, morphs to Sidebar Toggle on hover (Gemini UX) */}
          <div className="hidden group-data-[collapsible=icon]:flex justify-center w-full">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="group/toggle relative flex size-8 items-center justify-center rounded-lg cursor-pointer transition-colors hover:bg-sidebar-accent focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-sidebar-ring overflow-hidden"
                  />
                }
              >
                {/* 1. App Logo (Default visible, fades & scales down on hover) */}
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs transition-all duration-200 group-hover/toggle:opacity-0 group-hover/toggle:scale-75 absolute inset-0">
                  <Bot className="size-4.5" />
                </div>

                {/* 2. PanelLeft Toggle Icon (Fades in & scales up on hover) */}
                <div className="flex size-8 items-center justify-center rounded-lg text-foreground transition-all duration-200 opacity-0 scale-75 group-hover/toggle:opacity-100 group-hover/toggle:scale-100 absolute inset-0">
                  <PanelLeft className="size-4.5" />
                </div>

                <span className="sr-only">사이드바 열기</span>
              </TooltipTrigger>
              <TooltipContent side="right">사이드바 열기</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </SidebarHeader>

      {/* Pinned Primary Action Tools (New Chat & Search) - Stays fixed at top */}
      <div className="shrink-0 px-2 py-1.5 group-data-[collapsible=icon]:px-1">
        <SidebarGroup className="p-0">
          <SidebarMenu className="gap-1.5 group-data-[collapsible=icon]:items-center">
            {/* New Chat Action */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                onClick={() => createNewSession()}
                tooltip="새 대화 시작"
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-medium rounded-lg h-9 gap-2.5 justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:size-8 shadow-xs"
              >
                <Plus className="size-4 shrink-0" />
                <span className="group-data-[collapsible=icon]:hidden">새 대화 시작</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Conversation Search Action (Triggers Gemini-style Search Overlay) */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                onClick={() => openSearch()}
                tooltip="대화 검색 (⌘K)"
                className="rounded-lg h-9 text-muted-foreground hover:text-foreground justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:size-8 hover:bg-sidebar-accent border border-sidebar-border/40 bg-muted/20"
              >
                <Search className="size-4 shrink-0" />
                <span className="flex-1 text-left truncate group-data-[collapsible=icon]:hidden">대화 검색</span>
                <kbd className="hidden group-data-[collapsible=icon]:hidden sm:inline-flex h-4.5 select-none items-center gap-0.5 rounded-sm border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  ⌘K
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </div>

      {/* Scrollable Middle: Recent Chat Sessions ONLY (with Lazy Loading / Infinite Scroll) */}
      <SidebarContent className="flex-1 min-h-0 overflow-y-auto px-2 py-1 group-data-[collapsible=icon]:hidden overscroll-contain">
        {/* User Chat Sessions Section */}
        <SidebarGroup className="p-0 pt-1">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <div className="flex items-center gap-1.5">
              <SidebarGroupLabel className="p-0 text-[11px] font-medium text-muted-foreground tracking-normal">
                최근 대화
              </SidebarGroupLabel>
              {sessions.length > 0 && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({sessions.length})
                </span>
              )}
            </div>
            <SidebarGroupAction
              title="새 대화 만들기"
              onClick={() => createNewSession()}
            >
              <Plus className="size-3.5" />
              <span className="sr-only">새 대화 만들기</span>
            </SidebarGroupAction>
          </div>

          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading && sessions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground animate-pulse">
                  대화 목록 로딩 중...
                </div>
              ) : (
                <>
                  {sessions.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-muted-foreground border border-dashed rounded-md mx-1 my-1">
                      저장된 대화 기록이 없습니다.
                    </div>
                  ) : (
                    displayedSessions.map((session) => {
                      const isActive = pathname === "/" && session.id === activeSessionId;
                      const isEditing = editingSessionId === session.id;

                      return (
                        <SidebarMenuItem key={session.id}>
                          {isEditing ? (
                            <div className="flex items-center gap-1 px-1 py-1">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveRename(session.id);
                                  if (e.key === "Escape") setEditingSessionId(null);
                                }}
                                className="flex-1 h-7 text-xs px-2 rounded bg-background border border-input focus:outline-hidden focus:ring-1 focus:ring-primary"
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-emerald-500 hover:text-emerald-600"
                                onClick={() => handleSaveRename(session.id)}
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-6 text-muted-foreground"
                                onClick={() => setEditingSessionId(null)}
                              >
                                <X className="size-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <SidebarMenuButton
                                isActive={isActive}
                                onClick={() => switchSession(session.id)}
                                tooltip={session.title}
                                className="font-normal text-xs justify-between group/btn"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <MessageSquare
                                    className={`size-3.5 shrink-0 ${
                                      isActive ? "text-primary font-medium" : "text-muted-foreground"
                                    }`}
                                  />
                                  <span className="truncate">{session.title}</span>
                                </div>
                                {isSessionGenerating(session.id) && (
                                  <span
                                    className="size-2 rounded-full bg-primary animate-pulse shrink-0 ml-1.5"
                                    title="답변 생성 중..."
                                  />
                                )}
                              </SidebarMenuButton>

                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <SidebarMenuAction
                                      showOnHover
                                      className="text-muted-foreground hover:text-foreground"
                                    />
                                  }
                                >
                                  <MoreHorizontal className="size-3.5" />
                                  <span className="sr-only">더 보기</span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="start" className="w-36">
                                  <DropdownMenuItem
                                    onClick={() => handleStartRename(session.id, session.title)}
                                    className="gap-2 text-xs cursor-pointer"
                                  >
                                    <Pencil className="size-3.5" />
                                    <span>제목 변경</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => deleteSession(session.id)}
                                    className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>대화 삭제</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          )}
                        </SidebarMenuItem>
                      );
                    })
                  )}

                  {/* Invisible Lazy Loading Trigger Sentinel */}
                  {hasMore && (
                    <SidebarMenuItem
                      ref={sentinelRef}
                      className="h-px opacity-0 pointer-events-none p-0 m-0 overflow-hidden"
                      aria-hidden="true"
                    />
                  )}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Sidebar Footer with User Profile */}
      <SidebarFooter className="p-2 pt-1">
        <NavUser />
      </SidebarFooter>

      {/* Collapsible Rail */}
      <SidebarRail />
    </Sidebar>
  );
}
