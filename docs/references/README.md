# LangChain & Deep Agents Official Architecture References

> Complete offline reference archive for Deep Agents, LangChain Agent Harness, Middleware, CopilotKit UI Integration, and LangGraph Runtime.
> Sourced directly from https://docs.langchain.com

## Documentation Sections

### 1. [Deep Agents Python SDK](deepagents/README.md) (`docs/references/deepagents/`)
- **Core Architecture**: [Overview](deepagents/overview.md), [Quickstart](deepagents/quickstart.md), [Customization](deepagents/customization.md), [Comparison](deepagents/comparison.md)
- **Execution Environment**: [Backends](deepagents/backends.md), [Tools](deepagents/tools.md), [Permissions](deepagents/permissions.md), [Sandboxes](deepagents/sandboxes.md), [Interpreters](deepagents/interpreters.md), [MCP](deepagents/mcp.md)
- **Context & Memory**: [Memory](deepagents/memory.md), [Skills](deepagents/skills.md), [Context Engineering](deepagents/context-engineering.md), [Multimodal](deepagents/multimodal.md), [OpenWiki](deepagents/openwiki.md)
- **Delegation & Subagents**: [Subagents](deepagents/subagents.md), [Async Subagents](deepagents/async-subagents.md), [Dynamic Subagents](deepagents/dynamic-subagents.md)
- **Steering & HITL**: [Human-In-The-Loop](deepagents/human-in-the-loop.md), [Streaming](deepagents/streaming.md), [Event Streaming](deepagents/event-streaming.md)
- **Frontend Streaming**: [Todo List](deepagents/frontend/todo-list.md), [Subagent Streaming](deepagents/frontend/subagent-streaming.md), [Sandbox UI](deepagents/frontend/sandbox.md)

### 2. [Deep Agents Code (CLI & Coding Harness)](deepagents/code/overview.md) (`docs/references/deepagents/code/`)
- [CLI Overview](deepagents/code/overview.md), [Quickstart](deepagents/code/quickstart.md), [Configuration](deepagents/code/configuration.md), [Config File](deepagents/code/config-file.md)
- [CLI Reference](deepagents/code/cli-reference.md), [Approval Modes](deepagents/code/approval-modes.md), [Hooks](deepagents/code/hooks.md), [Memory & Skills](deepagents/code/memory-and-skills.md)
- [Remote Sandboxes](deepagents/code/remote-sandboxes.md), [Subagents](deepagents/code/subagents.md), [Plugins](deepagents/code/plugins.md)

### 3. [Foundational Concepts](concepts/products.md) (`docs/references/concepts/`)
- [Runtimes, Frameworks, and Harnesses](concepts/products.md) - Deep Agents vs. LangGraph vs. LangChain architectural relationship
- [Context Engineering Overview](concepts/context.md) - Managing agent context lifecycle
- [Memory Architecture](concepts/memory.md) - Short-term vs. Long-term memory models
- [Providers and Models](concepts/providers-and-models.md) - LLM provider integrations

### 4. [LangChain Agents & Middleware](langchain-agents/agents.md) (`docs/references/langchain-agents/`)
- **Middleware Architecture**: [Overview](langchain-agents/middleware/overview.md), [Prebuilt Middleware](langchain-agents/middleware/built-in.md) (TodoList, Summarization, Context Offload), [Custom Middleware](langchain-agents/middleware/custom.md)
- **Frontend & CopilotKit**: [CopilotKit Integration Guide](langchain-agents/frontend/integrations/copilotkit.md), [Generative UI Overview](langchain-agents/frontend/generative-ui-overview.md), [Controlled Generative UI](langchain-agents/frontend/controlled-generative-ui.md)
- **Chat UX**: [Branching Chat](langchain-agents/frontend/branching-chat.md), [Time Travel](langchain-agents/frontend/time-travel.md), [Join/Rejoin Streams](langchain-agents/frontend/join-rejoin.md)
- **Multi-Agent Patterns**: [Multi-Agent Overview](langchain-agents/multi-agent/index.md), [Handoffs](langchain-agents/multi-agent/handoffs.md), [Router](langchain-agents/multi-agent/router.md), [Subagents](langchain-agents/multi-agent/subagents.md)

### 5. [LangGraph Runtime](langgraph-runtime/overview.md) (`docs/references/langgraph-runtime/`)
- [StateGraph & Workflows](langgraph-runtime/workflows-agents.md), [Graph API](langgraph-runtime/graph-api.md)
- [Checkpointers (Persistence)](langgraph-runtime/checkpointers.md), [Stores (Long-term Store)](langgraph-runtime/stores.md)
- [Interrupts & Human-In-The-Loop](langgraph-runtime/interrupts.md), [Streaming & astream_events](langgraph-runtime/streaming.md)
- [Subgraphs](langgraph-runtime/use-subgraphs.md), [Thinking in LangGraph](langgraph-runtime/thinking-in-langgraph.md)

### 6. [CopilotKit UI & Runtime SDK](copilotkit/README.md) (`docs/references/copilotkit/`)
- **FastAPI + LangGraph AG-UI Backend**: [AG-UI Concept](copilotkit/1-backend-fastapi/ag-ui-concept.md), [Runtime Endpoints](copilotkit/1-backend-fastapi/runtime-endpoints.md), [Agent Runner](copilotkit/1-backend-fastapi/agent-runner.md), [LangGraph AG-UI Agent](copilotkit/1-backend-fastapi/langgraph-agent.md), [AG-UI Protocol & Events](copilotkit/1-backend-fastapi/ag-ui-events-protocol.md), [FastAPI Server Setup](copilotkit/1-backend-fastapi/fastapi-server-setup.md)
- **Deep Agents Integration**: [Overview](copilotkit/2-deepagents/overview.md), [LangGraph & Deep Agents Integration](copilotkit/2-deepagents/deep-agents-integration.md), [Middleware Architecture](copilotkit/2-deepagents/middleware-architecture.md), [MCP Protocol](copilotkit/2-deepagents/mcp-protocol.md), [A2A Protocols](copilotkit/2-deepagents/agent-to-agent.md)
- **Next.js Copilot Runtime**: [Runtime Overview](copilotkit/3-runtime-nextjs/copilot-runtime-overview.md), [Server Adapter](copilotkit/3-runtime-nextjs/runtime-server-adapter.md), [CopilotRuntime Class](copilotkit/3-runtime-nextjs/copilot-runtime-class.md), [Auth & Session Forwarding](copilotkit/3-runtime-nextjs/auth-and-sessions.md)
- **React SDK Hooks & UI**: [Which Hook Guide](copilotkit/4-react-hooks-and-ui/which-hook-guide.md), [useCopilotChat](copilotkit/4-react-hooks-and-ui/useCopilotChat.md), [useCopilotAction](copilotkit/4-react-hooks-and-ui/useCopilotAction.md), [useCopilotReadable](copilotkit/4-react-hooks-and-ui/useCopilotReadable.md), [useCoAgent](copilotkit/4-react-hooks-and-ui/useCoAgent.md), [useAgent](copilotkit/4-react-hooks-and-ui/useAgent.md), [useRenderTool](copilotkit/4-react-hooks-and-ui/useRenderTool.md), [useRenderToolCall](copilotkit/4-react-hooks-and-ui/useRenderToolCall.md), [Generative UI](copilotkit/4-react-hooks-and-ui/generative-ui-overview.md), [Components](copilotkit/4-react-hooks-and-ui/component-copilotkit.md)
- **Advanced Workflows & HITL**: [Human-In-The-Loop](copilotkit/5-advanced-patterns/human-in-the-loop.md), [useInterrupt](copilotkit/5-advanced-patterns/useInterrupt.md), [Shared State Streaming](copilotkit/5-advanced-patterns/shared-state-streaming.md), [Multimodal Attachments](copilotkit/5-advanced-patterns/multimodal-attachments.md), [Thread Lifecycle](copilotkit/5-advanced-patterns/threads-lifecycle.md), [Troubleshooting & Debugging](copilotkit/5-advanced-patterns/troubleshooting-common-issues.md)