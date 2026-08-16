## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues (using `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Maps canonical triage roles to GitHub issue labels. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context domain docs layout (`CONTEXT-MAP.md` + per-package `CONTEXT.md` files). See `docs/agents/domain.md`.

### Primary reference docs

Curated offline primary sources for CopilotKit, Deep Agents, and LangGraph live under `docs/references/` (indexed in `docs/references/README.md`). Agents MUST consult these primary sources before designing architectures or implementing features touching these frameworks.

### UI components & shadcn rules

Frontend UI in `@repo/ui` and `apps/web` strictly follows shadcn design and composition rules (`.agents/skills/shadcn/rules/`).
- **`@repo/ui` Primitives Purity**: Components under `packages/ui/src/components/` MUST maintain 100% fidelity to the official upstream shadcn registry (`base-lyra`). Do NOT modify base primitives directly for application-specific behaviors or styles so that `npx shadcn add` remains fully idempotent.
- **Composition Layer Customization**: All application-specific styles, layout behaviors, and responsive adaptations MUST live in the composition layer (`apps/web` or wrapper components), composing existing shadcn primitives (`Card`, `Dialog`, `Alert`, `Message`, `Bubble`, `AttachmentGroup`, `MessageScroller`) using semantic tokens and `data-icon` rather than hand-rolling custom markup.

