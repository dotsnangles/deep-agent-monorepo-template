"use client";

import { Toaster } from "@hollow-echo-distant-signal/ui/components/sonner";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange scriptProps={{ "data-cfasync": "false" }}>
      {children}
      <Toaster richColors />
    </ThemeProvider>
  );
}
