"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronsUpDown,
  LogOut,
  Moon,
  Sparkles,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/avatar";
import { Badge } from "@repo/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/ui/components/sidebar";
import { Skeleton } from "@repo/ui/components/skeleton";
import { authClient } from "@/lib/auth-client";

export function NavUser() {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { setTheme, theme } = useTheme();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex items-center gap-3 p-2">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            render={<Link href="/login" />}
            variant="outline"
            className="w-full justify-center gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 font-medium"
          >
            <UserIcon className="size-4" />
            <span>로그인 / 회원가입</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const user = session.user;
  const initials = (user.name || user.email || "U")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = () => {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
          router.refresh();
        },
      },
    });
  };

  return (
    <SidebarMenu className="group-data-[collapsible=icon]:items-center">
      <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:size-8"
              />
            }
          >
            <Avatar className="size-8 rounded-lg shrink-0">
              {user.image ? (
                <AvatarImage src={user.image} alt={user.name || ""} />
              ) : null}
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate font-semibold text-foreground">
                {user.name || "사용자"}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {user.email}
              </span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-60 min-w-56 rounded-lg p-1.5"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <div className="flex items-center gap-2 px-2 py-1.5 text-left text-xs">
                <Avatar className="size-8 rounded-lg">
                  {user.image ? (
                    <AvatarImage src={user.image} alt={user.name || ""} />
                  ) : null}
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-xs leading-tight">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium text-foreground">
                      {user.name || "사용자"}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                      Free
                    </Badge>
                  </div>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-xs"
                onClick={() => router.push("/dashboard")}
              >
                <Sparkles className="size-3.5 text-amber-500" />
                <span>대시보드 바로가기</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-xs"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="size-3.5" />
                    <span>라이트 모드로 전환</span>
                  </>
                ) : (
                  <>
                    <Moon className="size-3.5" />
                    <span>다크 모드로 전환</span>
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="gap-2 cursor-pointer text-xs"
              onClick={handleSignOut}
            >
              <LogOut className="size-3.5" />
              <span>로그아웃</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
