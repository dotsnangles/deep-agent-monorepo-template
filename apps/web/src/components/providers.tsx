"use client";

import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import { Toaster } from "@repo/ui/components/sonner";

import { ChatSessionProvider, useChatSessions } from "@/features/chat";
import { ThemeProvider } from "./theme-provider";

function CopilotKitWithSession({ children }: { children: React.ReactNode }) {
  const { activeSessionId } = useChatSessions();

  return (
    <CopilotKit
      key={activeSessionId} // Key ensures clean thread checkpoint synchronization
      runtimeUrl={process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL || "/api/copilotkit"}
      agent="default"
      threadId={activeSessionId}
      showDevConsole={false}
      headers={{
        "x-copilotkit-thread-id": activeSessionId,
      }}
    >
      {children}
    </CopilotKit>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <ChatSessionProvider>
        <CopilotKitWithSession>{children}</CopilotKitWithSession>
      </ChatSessionProvider>
      <Toaster richColors />
    </ThemeProvider>
  );
}
