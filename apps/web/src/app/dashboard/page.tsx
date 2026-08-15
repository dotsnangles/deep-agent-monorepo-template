import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

import { Badge } from "@hollow-echo-distant-signal/ui/components/badge";
import { authClient } from "@/lib/auth-client";
import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { data: customerState } = await authClient.customer.state({
    fetchOptions: {
      headers: await headers(),
    },
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="size-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl text-foreground">
              플랫폼 대시보드
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            환영합니다, <span className="font-semibold text-foreground">{session.user.name}</span>님. 계정 및 구독 상태를 관리하세요.
          </p>
        </div>
      </div>

      <Dashboard session={session} customerState={customerState} />
    </div>
  );
}
