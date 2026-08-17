"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Check,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

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
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@repo/ui/components/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { NavUser } from "@/features/auth";
import { useChatSessions } from "@/features/chat";
import { authClient } from "../../../lib/auth-client";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { state, toggleSidebar } = useSidebar();
  const { data: authSession, isPending: isAuthPending } = authClient.useSession();
  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

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

  // High-performance DOM Virtualizer for sidebar
  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 8,
  });

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

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/35" {...props}>
      {/* Workspace / Brand Header (Only Brand Identity & Sidebar Toggle) */}
      <SidebarHeader className="shrink-0 pt-4 pb-1 px-3 group-data-[collapsible=icon]:pt-3 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:pb-1">
        {/* App Identity / Brand Row & Sidebar Toggle */}
        <div className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          {/* Expanded Mode: Brand Logo + Name */}
          <Link
            href="/"
            onClick={() => createNewSession()}
            className="flex items-center gap-2.5 rounded-lg hover:opacity-85 transition-opacity group-data-[collapsible=icon]:hidden min-w-0 cursor-pointer"
          >
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs shrink-0">
              <Bot className="size-4.5" />
            </div>
            <span className="text-sm font-semibold text-foreground tracking-tight truncate">
              Deep Agent
            </span>
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
      <div className="shrink-0 px-2 pt-2 pb-1 group-data-[collapsible=icon]:px-1">
        <SidebarGroup className="p-0">
          <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
            {/* New Chat Action */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                onClick={() => createNewSession()}
                tooltip="새 대화 시작"
                className="text-foreground/90 hover:text-foreground font-normal rounded-lg h-9 gap-2.5 justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:size-8 hover:bg-sidebar-accent transition-colors"
              >
                <Plus className="size-4 shrink-0 text-muted-foreground" />
                <span className="group-data-[collapsible=icon]:hidden text-sm">새 대화 시작</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Conversation Search Action (Triggers Gemini-style Search Overlay) */}
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                onClick={() => openSearch()}
                tooltip="대화 검색 (⌘K)"
                className="rounded-lg h-9 text-muted-foreground hover:text-foreground font-normal justify-start group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:size-8 hover:bg-sidebar-accent transition-colors gap-2.5"
              >
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left truncate group-data-[collapsible=icon]:hidden text-sm">대화 검색</span>
                <kbd className="hidden group-data-[collapsible=icon]:hidden sm:inline-flex h-4.5 select-none items-center gap-0.5 rounded-sm border border-sidebar-border/40 bg-muted/40 px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-80">
                  ⌘K
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </div>

      {/* Scrollable Middle: Recent Chat Sessions ONLY (with High-Performance DOM Virtualization) */}
      <SidebarContent
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto no-scrollbar scrollbar-none px-2 py-1 group-data-[collapsible=icon]:hidden overscroll-contain"
      >
        {/* User Chat Sessions Section */}
        <SidebarGroup className="p-0 pt-4">
          <div className="flex items-center justify-between px-2.5 pb-2">
            <SidebarGroupLabel className="p-0 text-xs font-medium text-muted-foreground/70 tracking-normal">
              최근 대화
            </SidebarGroupLabel>
            {sessions.length > 0 && (
              <span className="text-[10px] text-muted-foreground/60 font-mono">
                {sessions.length}
              </span>
            )}
          </div>

          <SidebarGroupContent>
            {isLoading && sessions.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="size-5 rounded-full border-2 border-muted-foreground/20 border-t-foreground/80 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="px-2.5 py-4 text-xs text-muted-foreground/50 select-none">
                {!authSession?.user && !isAuthPending
                  ? "로그인하면 대화 기록이 저장됩니다."
                  : "최근 대화가 없습니다."}
              </div>
            ) : (
              <div
                className="animate-in fade-in duration-300"
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const session = sessions[virtualRow.index];
                  if (!session) return null;
                  const isActive = pathname === "/" && session.id === activeSessionId;
                  const isEditing = editingSessionId === session.id;

                  return (
                    <div
                      key={session.id}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <SidebarMenuItem className="h-full list-none">
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
                              className="font-normal text-xs md:text-[13px] h-8.5 rounded-lg justify-between group/btn text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 data-[active=true]:bg-sidebar-accent data-[active=true]:text-foreground data-[active=true]:font-medium px-2.5 transition-colors"
                            >
                              <span className="truncate flex-1 text-left">{session.title}</span>
                              {isSessionGenerating(session.id) && (
                                <span className="relative flex size-2 shrink-0 ml-1.5" title="답변 생성 중...">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                  <span className="relative inline-flex rounded-full size-2 bg-primary" />
                                </span>
                              )}
                            </SidebarMenuButton>

                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <SidebarMenuAction
                                    showOnHover
                                    className="text-muted-foreground/60 hover:text-foreground"
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
                    </div>
                  );
                })}
              </div>
            )}
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
