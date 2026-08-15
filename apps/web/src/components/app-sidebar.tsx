"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  CreditCard,
  Database,
  FileCode2,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  MessageSquareText,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@repo/ui/components/sidebar";
import { NavUser } from "@/components/nav-user";

const navGroups = [
  {
    title: "AI 에이전트",
    items: [
      {
        title: "에이전트 플레이그라운드",
        url: "/",
        icon: Sparkles,
        badge: "Live",
      },
      {
        title: "세션 기록",
        url: "#sessions",
        icon: MessageSquareText,
      },
      {
        title: "워크플로우 오케스트레이션",
        url: "#workflows",
        icon: GitBranch,
      },
    ],
  },
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

  const filteredGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((group) => group.items.length > 0);

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

        {/* Quick Filter Search */}
        <div className="relative mt-1 group-data-[collapsible=icon]:hidden px-1">
          <Search className="absolute left-3.5 top-2.5 size-3.5 text-muted-foreground" />
          <SidebarInput
            placeholder="메뉴 빠른 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="py-2">
        {filteredGroups.map((group) => (
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
                        {item.badge && (
                          <SidebarMenuBadge className="text-[9px] bg-primary/10 text-primary border border-primary/20">
                            {item.badge}
                          </SidebarMenuBadge>
                        )}
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
