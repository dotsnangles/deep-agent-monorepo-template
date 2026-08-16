# LangChain Deep Agents Official Documentation (Offline Reference)

> Official reference documentation for `deepagents` Python SDK and `Deep Agents Code`.
> Sourced directly from https://docs.langchain.com/oss/python/deepagents/

## Table of Contents

### 1. Core Concepts & Architecture
- [Overview](overview.md) - Deep Agents architecture, 4 core capabilities, and harness design
- [Quickstart](quickstart.md) - Getting started with `create_deep_agent`
- [Customization](customization.md) - Middleware stack, overrides, and extending deep agents
- [Comparison with Claude Agent SDK](comparison.md) - Deep Agents vs. Claude Agent SDK

### 2. Execution Environment & Tools
- [Backends](backends.md) - Pluggable filesystem backends (State, Store, Filesystem, Composite)
- [Tools](tools.md) - Built-in filesystem tools (`ls`, `read_file`, `write_file`, `edit_file`, `delete`, `glob`, `grep`) and custom tools
- [Permissions](permissions.md) - Declarative file access control rules
- [Sandboxes](sandboxes.md) - Isolated remote/local execution environments and shell commands
- [Interpreters](interpreters.md) - In-process QuickJS JavaScript evaluation
- [MCP (Model Context Protocol)](mcp.md) - Connecting external MCP servers and tools

### 3. Context Management & Memory
- [Memory](memory.md) - `AGENTS.md` persistent memory and conventions
- [Skills](skills.md) - `SKILL.md` Agent Skills standard and progressive disclosure
- [Context Engineering](context-engineering.md) - History summarization, context offloading, prompt caching
- [Multimodal](multimodal.md) - Handling image, audio, video, and document attachments
- [OpenWiki](openwiki.md) - Repository wiki generation and automatic knowledge loading

### 4. Delegation & Planning
- [Subagents](subagents.md) - Spawning child agents with isolated contexts via `task` tool
- [Async Subagents](async-subagents.md) - Background parallel subagent tasks
- [Dynamic Subagents](dynamic-subagents.md) - Runtime dynamically defined subagents
- [Frontend: Todo List](frontend/todo-list.md) - `TodoListMiddleware` and task planning streaming

### 5. Steering & Human-In-The-Loop
- [Human-In-The-Loop](human-in-the-loop.md) - `interrupt_on` configuration and human approvals
- [Event Streaming](event-streaming.md) - Structured event projections (`stream.subagents`, tokens, tool calls)
- [Streaming](streaming.md) - Streaming modes and transport
- [Frontend: Subagent Streaming](frontend/subagent-streaming.md) - Streaming subagent trees to UI
- [Frontend: Overview](frontend/overview.md) - Connecting Deep Agents to frontend UI
- [Frontend: Sandbox](frontend/sandbox.md) - UI rendering for sandboxes

### 6. Production & Advanced Guides
- [Going to Production](going-to-production.md) - Observability, LangSmith, deployment
- [Fault Tolerance](fault-tolerance.md) - Retries, fallback models, error recovery
- [Models](models.md) - Supported LLM providers (Anthropic, OpenAI, Google, Ollama, OpenRouter, etc.)
- [Profiles](profiles.md) - Harness profiles and model tuning
- [Retrieval](retrieval.md) & [RAG](rag.md) - Retrieval Augmented Generation with Deep Agents
- [Grading Rubrics](rubric.md) - Evaluation rubrics for agent task verification
- [Agent-to-Agent (A2A)](a2a.md) & [ACP](acp.md) - Agent Client Protocol and server protocols

### 7. Deep Agents Code (CLI & Coding Harness)
- [Code: Overview](code/overview.md) - Terminal coding agent built on Deep Agents SDK
- [Code: Quickstart](code/quickstart.md) - Running Deep Agents Code CLI
- [Code: Configuration](code/configuration.md) & [Config File](code/config-file.md) - `config.toml` setup
- [Code: CLI Reference](code/cli-reference.md) - CLI flags and options
- [Code: Approval Modes](code/approval-modes.md) - Manual, Auto, and YOLO modes
- [Code: Hooks](code/hooks.md) - Command hooks lifecycle
- [Code: Memory & Skills](code/memory-and-skills.md) - Project memory and skills discovery
- [Code: Plugins](code/plugins.md) - Marketplace and custom plugins
- [Code: Remote Sandboxes](code/remote-sandboxes.md) - E2B, Modal, Daytona, LangSmith sandboxes
- [Code: Subagents](code/subagents.md) - Subagent definitions for Deep Agents Code

### 8. Example Use Cases / Cookbooks
- [Deep Research Agent](deep-research.md) - Building autonomous deep research pipelines
- [Data Analysis Agent](data-analysis.md) - Python data science & analysis agent
- [Content Builder Agent](content-builder.md) - Long-form structured content drafting agent

### 9. Changelogs
- [Python SDK Changelog](changelog-py.md)
- [JS SDK Changelog](changelog-js.md)
- [Code CLI Changelog](code/changelog.md)