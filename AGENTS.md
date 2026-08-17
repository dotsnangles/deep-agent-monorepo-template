## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues (using `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Maps canonical triage roles to GitHub issue labels. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context domain docs layout (`CONTEXT-MAP.md` + per-package `CONTEXT.md` files). See `docs/agents/domain.md`.

### Primary reference docs

Curated offline primary sources for CopilotKit, Deep Agents, and LangGraph. See `docs/references/README.md`.
- Consult these primary sources before designing or modifying code touching these frameworks.

### UI components & shadcn rules

Frontend component composition and styling standards. See `.agents/skills/shadcn/rules/`.
- Keep `@repo/ui` primitives 100% pure to upstream shadcn (`base-lyra`).
- Place all app-specific customization and layouts in the composition layer (`apps/web`).

### Code navigation & CodeGraph

Semantic code intelligence and knowledge graph navigation. See `.agents/skills/codegraph/SKILL.md`.
- Reach for `codegraph` before falling back to `grep` when exploring architecture, tracing call hierarchies, or assessing refactoring impact.

### Browser testing & Chrome DevTools

Live browser automation, visual QA, and runtime debugging. See `.agents/skills/chrome-devtools/SKILL.md`.
- Reach for `chrome-devtools` when verifying UI rendering (`apps/web`), diagnosing console errors, or inspecting SSE/streaming requests.
