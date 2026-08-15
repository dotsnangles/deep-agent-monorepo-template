import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "../index.css";
import { AppSidebar } from "@/features/sidebar";
import Providers, { CopilotKitWithSession } from "@/components/providers";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/components/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hollow Echo | AI Deep Agent Platform",
  description: "LangChain create_deep_agent 및 CopilotKit 기반 AI 에이전트 SaaS 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="min-w-0 flex flex-col h-svh overflow-hidden bg-background">
              {/* Mobile-only compact header */}
              <div className="flex md:hidden items-center justify-between p-3 border-b border-border/50 bg-background/80 backdrop-blur-xs shrink-0">
                <SidebarTrigger />
                <span className="font-semibold text-xs text-foreground">Hollow Echo</span>
                <div className="size-7" />
              </div>

              {/* Full-bleed Immersion Canvas */}
              <main className="flex-1 min-h-0 relative flex flex-col h-full overflow-hidden">
                <CopilotKitWithSession>
                  {children}
                </CopilotKitWithSession>
              </main>
            </SidebarInset>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  );
}
