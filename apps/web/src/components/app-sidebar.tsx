"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Check,
  CreditCard,
  Database,
  FileCode2,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
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
} from "@repo/ui/components/sidebar";
import { NavUser } from "@/components/nav-user";
import { useChatSessions } from "@/context/chat-session-context";

const navGroups = [
  {
    title: "플랫폼 & 데이터",
    items: [
      {
        title: "대시보드",
        url: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        title: "실행 메트릭 & 로그",
        url: "#metrics",
        icon: Activity,
      },
      {
        title: "프롬프트 템플릿",
        url: "#prompts",
        icon: FileCode2,
      },
      {
        title: "오브젝트 스토리지",
        url: "#storage",
        icon: Database,
      },
    ],
  },
  {
    title: "설정 & 관리",
    items: [
      {
        title: "API 키 & 런타임",
        url: "#keys",
        icon: KeyRound,
      },
      {
        title: "플랜 및 사용량",
        url: "#billing",
        icon: CreditCard,
      },
      {
        title: "워크스페이스 설정",
        url: "#settings",
        icon: Settings,
      },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");

  const {
    sessions,
    activeSessionId,
    createNewSession,
    switchSession,
    deleteSession,
    renameSession,
    isLoading,
    isDraft,
  } = useChatSessions();

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

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border" {...props}>
      {/* SaaS Workspace Header */}
      <SidebarHeader className="border-b border-sidebar-border/60 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/" />}
              size="lg"
              className="gap-3 hover:bg-sidebar-accent/70"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Bot className="size-4" />
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
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* New Chat Primary Button */}
        <div className="px-1 mt-1 group-data-[collapsible=icon]:hidden">
          <Button
            size="sm"
            className="w-full justify-start gap-2 h-8 text-xs font-medium shadow-xs"
            onClick={() => createNewSession()}
          >
            <Plus className="size-3.5" />
            <span>새 대화 시작</span>
          </Button>
        </div>

        {/* Quick Filter Search */}
        <div className="relative mt-1 group-data-[collapsible=icon]:hidden px-1">
          <Search className="absolute left-3.5 top-2.5 size-3.5 text-muted-foreground" />
          <SidebarInput
            placeholder="대화 또는 메뉴 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </SidebarHeader>

      {/* Navigation & Chat Sessions Content */}
      <SidebarContent className="py-2">
        {/* Main Agent Hub */}
        <SidebarGroup>
          <SidebarGroupLabel>AI 에이전트</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/" />}
                  isActive={pathname === "/"}
                  tooltip="에이전트 플레이그라운드"
                  className="font-medium text-xs"
                >
                  <Sparkles className="size-4 text-sidebar-foreground/70 group-data-[active=true]:text-primary" />
                  <span>에이전트 플레이그라운드</span>
                  <SidebarMenuBadge className="text-[9px] bg-primary/10 text-primary border border-primary/20">
                    Live
                  </SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="#workflows" />}
                  tooltip="워크플로우 오케스트레이션"
                  className="font-medium text-xs"
                >
                  <GitBranch className="size-4 text-sidebar-foreground/70" />
                  <span>워크플로우 오케스트레이션</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Chat Sessions Section */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between px-2 py-1">
            <SidebarGroupLabel className="p-0">내 대화 세션 기록</SidebarGroupLabel>
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
              {isLoading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground animate-pulse">
                  세션 목록 로딩 중...
                </div>
              ) : (
                <>
                  {/* Active Draft Session Indicator */}
                  {isDraft && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={pathname === "/"}
                        tooltip="새로운 대화 (작성 중)"
                        className="font-normal text-xs justify-between text-primary/90 bg-primary/5 border border-dashed border-primary/30"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MessageSquarePlus className="size-3.5 shrink-0 text-primary animate-pulse" />
                          <span className="truncate font-medium">새로운 대화 (작성 중...)</span>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {filteredSessions.length === 0 && !isDraft ? (
                    <div className="px-3 py-3 text-center text-xs text-muted-foreground border border-dashed rounded-md mx-2 my-1">
                      저장된 대화 기록이 없습니다.
                    </div>
                  ) : (
                    filteredSessions.map((session) => {
                      const isActive = pathname === "/" && session.id === activeSessionId;
                      const isEditing = editingSessionId === session.id;

                      return (
                        <SidebarMenuItem key={session.id}>
                          {isEditing ? (
                            <div className="flex items-center gap-1 px-2 py-1">
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
                                    className="gap-2 text-xs"
                                  >
                                    <Pencil className="size-3.5" />
                                    <span>제목 변경</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => deleteSession(session.id)}
                                    className="gap-2 text-xs text-destructive focus:text-destructive"
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
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Other Platform Navigation */}
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive =
                    item.url === "/"
                      ? pathname === "/"
                      : item.url.startsWith("/") && pathname.startsWith(item.url);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        render={<Link href={item.url as any} />}
                        isActive={isActive}
                        tooltip={item.title}
                        className="font-medium text-xs"
                      >
                        <item.icon className="size-4 text-sidebar-foreground/70 group-data-[active=true]:text-primary" />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />

      {/* Sidebar Footer with User Profile */}
      <SidebarFooter className="pt-2">
        <NavUser />
      </SidebarFooter>

      {/* Collapsible Rail */}
      <SidebarRail />
    </Sidebar>
  );
}
