# 0009. Client-side Global Background Streaming and Reconnection

## Status
Accepted

## Context
When a user switched between chat sessions while an AI response was streaming, the active view component unmounted. The underlying fetch stream lacked a centralized coordinator, leading to uncoordinated state updates and no visual feedback on which background sessions were actively generating.

## Decision
We manage active AI streaming lifecycles at the client-side global context layer (`ChatStreamContext` / `ChatSessionProvider`).
1. **Global Stream Registry**: Active fetch streams and their accumulated chunk buffers are tracked by `sessionId` across component unmounts.
2. **Background Persistence**: If the user navigates away, the global manager continues consuming the stream and automatically persists the completed assistant message to the database.
3. **Stream Reconnection & Replay**: When the user switches back to a session that is still generating, the view re-attaches to the active stream buffer and continues real-time chunk rendering.
4. **Visual Indicator & Concurrency**: Inactive sessions actively generating display real-time status badges in the sidebar, and concurrent multi-session streaming is fully supported.
