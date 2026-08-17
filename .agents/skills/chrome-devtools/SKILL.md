---
name: chrome-devtools
description: Chrome browser automation, live UI visual QA, and frontend runtime debugging. Use when verifying web UI layouts/screenshots, inspecting console errors, diagnosing network/SSE streaming requests, or running interactive browser flows.
---

# Chrome DevTools Automation & Debugging

Use this skill to control and inspect a live Chrome browser via the Chrome DevTools MCP server (`chrome-devtools`) for automated UI testing, visual QA, client-side debugging, and full-stack stream inspection.

## When to Use

- **Visual & Layout Verification**: Confirming that UI changes in `apps/web` and `@repo/ui` render correctly across desktop and mobile viewports (`take_screenshot`, `resize_page`, `emulate`).
- **Client Runtime & Hydration Debugging**: Diagnosing React hydration mismatches, uncaught exceptions, and console warnings using source-mapped stack traces (`list_console_messages`, `get_console_message`).
- **Full-Stack & Stream Inspection**: Tracing real-time Server-Sent Events (SSE), WebSocket connections, CopilotKit actions, and failed API payloads between `apps/web` and `apps/agent` (`list_network_requests`, `get_network_request`).
- **Interactive Flow & Form Automation**: Automating user journeys, clicking buttons, submitting multi-field forms, and verifying state transitions (`navigate_page`, `fill_form`, `click`, `wait_for`).
- **Performance & Web Audits**: Investigating UI latency, layout shifts, Core Web Vitals, or memory leaks (`lighthouse_audit`, `performance_*`, `take_heapsnapshot`).

## When NOT to Use

- Running headless automated unit tests (e.g. `pnpm test`, `vitest`, `pytest`) — execute them directly via `run_command`.
- Inspecting static source code without browser rendering — use `codegraph` or code reading tools.
- Backend-only tasks that do not involve web rendering or frontend client interactions.

---

## Tool Category Selection Guide

### 1. Navigation & Page Management
- `navigate_page`: Navigate to a local dev server URL (e.g. `http://localhost:3000`) or external page.
- `new_page` / `close_page`: Open or close browser tabs.
- `wait_for`: Explicitly wait for a CSS selector or DOM condition before proceeding to the next step.

### 2. Efficient User Interactions
- **Prefer Batch Forms**: Use `fill_form` to populate multiple inputs at once instead of sequential `type_text` calls.
- **Precision Clicks**: Use `click` (with selector) or `hover` to trigger dropdowns, modals, and tooltips.
- **Keyboard & Special Inputs**: Use `press_key` for keyboard shortcuts (`Enter`, `Escape`), and `upload_file` for file input elements.

### 3. Visual QA & DOM Inspection
- **Visual Capture**: Call `take_screenshot` after modifying UI components to visually verify styles, layout alignment, and colors.
- **Responsive Testing**: Call `resize_page` (e.g. width `375`, height `667`) or `emulate` to test mobile breakpoints.
- **Accessibility & DOM Tree**: Call `take_snapshot` to inspect element accessibility labels, text nodes, and clickable tree hierarchies when selectors fail.

### 4. Console & Network Debugging
- **Console Errors**: Call `list_console_messages` to check for runtime exceptions, React warnings, or failed bundle loads.
- **Network Requests**: Call `list_network_requests` to inspect HTTP status codes, headers, and request timing.
- **Payload Inspection**: Call `get_network_request` with a `requestId` to inspect request bodies, CopilotKit JSON payloads, and SSE stream chunks.

### 5. In-Page JavaScript Execution
- `evaluate_script`: Run arbitrary JavaScript in the browser context (e.g. checking `window.__INITIAL_STATE__`, inspecting local storage, or querying React fiber nodes).

### 6. Deep Performance & Memory Audits
- Reserve `performance_start_trace` / `performance_stop_trace` and `lighthouse_audit` for targeted performance profiling.
- Use `take_heapsnapshot` when diagnosing frontend memory leaks during long-running sessions.

---

## Standard UI Verification Runbook

When implementing or modifying frontend UI features in `apps/web`:
1. Ensure the dev server is active.
2. `navigate_page` to the target route.
3. `wait_for` key UI containers (e.g. chat container, header, form).
4. `take_screenshot` to verify initial visual rendering.
5. Execute user interactions (`fill_form`, `click`).
6. `list_console_messages` to ensure zero runtime errors occurred.
7. `take_screenshot` to capture the resulting UI state.
