# 0010. Virtualized Session Lists, In-Memory Fuzzy Search, and Keyboard Synchronization

## Status
Accepted

## Context
As users accumulate hundreds to thousands of chat sessions, rendering all list elements directly into the DOM degrades UI performance, increases memory overhead, and causes scrolling jank. In the search modal (`ChatSearchDialog`), simple substring filtering lacked typo-tolerance and matching token visualization, while keyboard navigation did not coordinate with virtual scrolling viewports.

## Decision
We establish a high-performance session presentation and search architecture across both the sidebar (`AppSidebar`) and search dialog (`ChatSearchDialog`):
1. **DOM Virtualization via `@tanstack/react-virtual`**: Both the sidebar and search modal render only visible items within the active viewport (~10-15 DOM nodes) using fixed item height estimation and GPU-accelerated translate positioning.
2. **In-Memory Fuzzy Search & Token Highlighting**: We introduce a client-side fuzzy matcher (`fuzzyMatch`) with multi-token parsing, scoring, and substring segment tokenization for instant visual highlight feedback without network latency.
3. **Bi-Directional Keyboard Scroll Synchronization**: Arrow key navigation (`↑` / `↓`) in the search modal automatically computes boundary visibility and invokes `virtualizer.scrollToIndex` with smooth alignment, keeping selected items visible at all times.
4. **Optimistic & Streaming State Preservation**: Real-time generation indicators, inline renaming, and deletion actions remain fully integrated into the virtualized list items.
