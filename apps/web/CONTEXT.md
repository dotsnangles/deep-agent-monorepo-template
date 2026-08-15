# Web Domain Context (`apps/web`)

Domain glossary and architectural concepts for the Next.js 16 Web Application:

| Term | Definition | Location |
| --- | --- | --- |
| Next.js 16 Proxy | Successor to middleware.ts running request rewriting and security checks | `src/proxy.ts` |
| Instrumentation | Server lifecycle initialization hook running on Next.js NodeJS runtime | `src/instrumentation.ts` |
| Feature Slice | Encapsulated domain module containing components, hooks, and actions | `src/features/` |
| Chat Session Context | Client-side React context managing active thread IDs, local drafts, and session switching | `src/features/chat/` |
| Lazy Session | A client-only draft conversation state that only persists to the database upon first message | `src/features/chat/context/` |
| Server Redis Helper | Background title trigger isolated in `server.ts` to prevent client bundle pollution | `src/features/chat/server.ts` |
| Assistant Markdown Renderer | Client-side markdown, GFM, and KaTeX math parsing pipeline rendering rich AI output with code copy actions | `src/features/chat/components/markdown-renderer.tsx` |
| Message Canvas Layout | Stream layout where AI responses render directly on the canvas without redundant outer cards while user inputs render as right-aligned bubbles | `src/features/chat/components/message-item.tsx` |
| Smart Scroll Pinning | Scroll position tracking that pins user view when scrolled up during streaming and shows floating latest message jump button | `src/features/chat/hooks/use-smart-scroll.ts` |
| Abortable Stream Controller | Client-side AbortController signal manager enabling instantaneous user cancellation of streaming responses while persisting partial outputs | `src/features/chat/hooks/use-message-tree.ts` |
