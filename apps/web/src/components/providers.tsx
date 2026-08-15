"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import { Toaster } from "@hollow-echo-distant-signal/ui/components/sonner";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <CopilotKit
        runtimeUrl={process.env.NEXT_PUBLIC_COPILOTKIT_RUNTIME_URL || "/api/copilotkit"}
        agent="default"
        showDevConsole={false}
      >
        <CopilotSidebar defaultOpen={true} labels={{ title: "Hollow Echo Deep Agent" }}>
          {children}
        </CopilotSidebar>
      </CopilotKit>
      <Toaster richColors />
    </ThemeProvider>
  );
}
