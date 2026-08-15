"use client";

import { CreditCard, Sparkles, Zap } from "lucide-react";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { authClient } from "@/lib/auth-client";

export default function Dashboard({
  customerState,
  session,
}: {
  customerState: any;
  session: any;
}) {
  const hasProSubscription = (customerState?.activeSubscriptions?.length ?? 0) > 0;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Subscription Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">구독 및 멤버십 플랜</CardTitle>
            <Badge variant={hasProSubscription ? "default" : "secondary"}>
              {hasProSubscription ? "Pro Member" : "Free Tier"}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            현재 이용 중인 에이전트 컴퓨팅 플랜 및 결제 정보입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/60">
            <CreditCard className="size-5 text-primary" />
            <div className="text-xs">
              <p className="font-semibold text-foreground">
                {hasProSubscription ? "Pro 요금제 (무제한 에이전트 실행)" : "무료 스타터 요금제"}
              </p>
              <p className="text-muted-foreground text-[11px]">
                {hasProSubscription ? "월간 자동 갱신 활성화됨" : "기본 도구 및 로컬 모델 지원"}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          {hasProSubscription ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => await authClient.customer.portal()}
            >
              구독 관리 (Portal)
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={async () => await authClient.checkout({ slug: "pro" })}
            >
              <Sparkles className="size-3.5" />
              <span>Pro 플랜으로 업그레이드</span>
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">계정 프로필 정보</CardTitle>
          <CardDescription className="text-xs">
            현재 로그인된 사용자 세션 정보입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">이름:</span>
            <span className="font-medium text-foreground">{session?.user?.name || "사용자"}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-border/50">
            <span className="text-muted-foreground">이메일:</span>
            <span className="font-mono text-[11px] text-foreground">{session?.user?.email}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-muted-foreground">상태:</span>
            <span className="text-emerald-500 font-medium flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              인증 활성됨
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
