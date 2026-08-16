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

Frontend UI in `@repo/ui` and `apps/web` strictly follows shadcn design and composition rules (`.agents/skills/shadcn/rules/`). Agents MUST compose existing shadcn primitives (`Card`, `Dialog`, `Alert`, `Message`, `Bubble`, `AttachmentGroup`) using semantic tokens and `data-icon` rather than hand-rolling custom markup.
