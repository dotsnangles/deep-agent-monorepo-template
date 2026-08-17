---
name: codegraph
description: Semantic code intelligence and knowledge graph navigation. Use when exploring architecture, tracing function call hierarchies, finding symbol definitions, or assessing refactoring blast radius.
---

# CodeGraph Navigation & Intelligence

Use this skill to navigate the codebase using the pre-indexed semantic knowledge graph (`.codegraph/`) instead of burning context on repetitive `grep_search` and manual file traversals.

## Core Philosophy

Traditional code search (`grep`, `find`, `view_file`) requires many round-trips to reconstruct call paths, interface implementations, and cross-file relationships. CodeGraph provides a pre-built knowledge graph that extracts AST symbols, call edges, framework route bindings, and cross-file dependencies into SQLite with FTS5 search.

## When to Use

- **Architecture & Feature Flow**: Answering questions like *"How does a request flow from frontend to backend?"*, *"Where is this domain entity processed?"*, or exploring unfamiliar subsystems.
- **Call Hierarchy**: Finding all callers of a function (`callers`) or inspecting everything a function invokes (`callees`), including dynamic dispatch and interface implementations.
- **Symbol Detail & Verbatim Source**: Inspecting a function/class definition along with its immediate caller/callee context without opening multiple files.
- **Refactoring & Blast Radius**: Determining the full impact of changing a signature, type, or schema, and identifying all affected downstream code.
- **Targeted Test Selection**: Identifying which test files are affected by recent source modifications (`affected`) before running test suites.

## When NOT to Use

- Non-code text searches (e.g. searching inside `.env`, `.yaml`, `.json` data files, or Markdown documentation) — use standard `grep_search`.
- Viewing known lines of a specific single file when the path and line numbers are already established — use `view_file`.
- Repositories without a `.codegraph/` index directory.

---

## Tool Selection & Strategy

### 1. Broad Flow / Open-Ended Exploration
Use the **`codegraph_explore`** MCP tool (or CLI `codegraph explore "<query>"`):
- Returns verbatim source code of relevant symbols + multi-hop call paths + blast radius in a single round-trip.
- Example queries:
  - `codegraph explore "how do copilotkit actions register with fastapi"`
  - `codegraph explore "AgentExecutionGateway"`
  - `codegraph explore "ChatGraphFactory create_graph"`

### 2. Targeted / Pinpoint Inspection (CLI)
When you already know the specific symbol and only need localized relationships (to minimize context consumption), run targeted CLI commands via `run_command`:
- **Trace Callers**: `codegraph callers <symbol>` — Find all functions/methods that invoke `<symbol>`.
- **Trace Callees**: `codegraph callees <symbol>` — Find all functions/methods called by `<symbol>`.
- **Inspect Symbol/File**: `codegraph node <symbol>` — View symbol source, caller/callee trail, or line-numbered structure.
- **Impact Analysis**: `codegraph impact <symbol>` — Analyze downstream dependencies affected by modifying `<symbol>`.
- **Affected Tests**: `codegraph affected [files...]` — Extract only the test files affected by changed source files.
- **Fast Symbol Search**: `codegraph query <search>` — Search symbol definitions via FTS5 index.

### 3. Subagent Fallback
Subagents or background tasks without MCP tool bindings MUST use the CLI equivalent:
```bash
codegraph explore "<query>"
```

---

## Workflow Guide

1. **Explore First**: Start with `codegraph_explore` or `codegraph explore` to get the core code and call paths.
2. **Trace Seams**: Use `callers` / `callees` to verify boundary interfaces and contracts.
3. **Refactor & Assess**: Before finalizing changes, run `codegraph impact <symbol>` or `codegraph affected <modified_file>` to pinpoint affected modules and test suites.
4. **Targeted Verification**: Run only the affected test files instead of running the entire suite.
