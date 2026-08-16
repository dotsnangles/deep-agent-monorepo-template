# CopilotKit Official Architecture & API References

> Complete offline reference archive for CopilotKit, CoAgents, FastAPI AG-UI endpoint, Next.js CopilotRuntime, React SDK Hooks, Generative UI, and Human-In-The-Loop.
> Sourced directly from official CopilotKit repository (https://github.com/CopilotKit/CopilotKit).

## Documentation Sections

### 1. [FastAPI + LangGraph AG-UI Backend](1-backend-fastapi/ag-ui-concept.md) (`docs/references/copilotkit/1-backend-fastapi/`)
- **Serving & Protocols**: [AG-UI Concept](1-backend-fastapi/ag-ui-concept.md), [Runtime Endpoints](1-backend-fastapi/runtime-endpoints.md), [Agent Runner](1-backend-fastapi/agent-runner.md), [Self Managed Agents](1-backend-fastapi/self-managed-agents.md)
- **LangGraph Python SDK**: [LangGraph SDK Overview](1-backend-fastapi/langgraph-python-sdk.md), [LangGraph AG-UI Agent](1-backend-fastapi/langgraph-agent.md), [Remote Endpoints](1-backend-fastapi/remote-endpoints.md)
- **AG-UI Protocol Specification**: [Architecture](1-backend-fastapi/ag-ui-architecture.md), [Events Protocol](1-backend-fastapi/ag-ui-events-protocol.md), [FastAPI Server Setup](1-backend-fastapi/fastapi-server-setup.md), [Python Events SDK](1-backend-fastapi/python-events-sdk.md), [Python Types SDK](1-backend-fastapi/python-types-sdk.md)

### 2. [Deep Agents Integration](2-deepagents/overview.md) (`docs/references/copilotkit/2-deepagents/`)
- **Core Integration**: [Deep Agents Overview](2-deepagents/overview.md), [LangGraph & Deep Agents Integration](2-deepagents/deep-agents-integration.md)
- **Middleware & Protocols**: [AG-UI Middleware Architecture](2-deepagents/middleware-architecture.md), [MCP Protocol](2-deepagents/mcp-protocol.md), [Agent-to-Agent (A2A)](2-deepagents/agent-to-agent.md), [Multi-Agent Subagents](2-deepagents/subagents.md)

### 3. [Next.js Copilot Runtime](3-runtime-nextjs/copilot-runtime-overview.md) (`docs/references/copilotkit/3-runtime-nextjs/`)
- **Runtime Architecture**: [Copilot Runtime Overview](3-runtime-nextjs/copilot-runtime-overview.md), [Runtime Server Adapter](3-runtime-nextjs/runtime-server-adapter.md)
- **Runtime API Reference**: [CopilotRuntime Class](3-runtime-nextjs/copilot-runtime-class.md), [LangChain Adapter](3-runtime-nextjs/langchain-adapter.md), [Auth & Session Forwarding](3-runtime-nextjs/auth-and-sessions.md)

### 4. [React SDK Hooks & Generative UI](4-react-hooks-and-ui/which-hook-guide.md) (`docs/references/copilotkit/4-react-hooks-and-ui/`)
- **Hook Decision Matrix**: [Which Hook for Which Job](4-react-hooks-and-ui/which-hook-guide.md)
- **Core Hooks**: [useCopilotChat](4-react-hooks-and-ui/useCopilotChat.md), [useCopilotAction](4-react-hooks-and-ui/useCopilotAction.md), [useCopilotReadable](4-react-hooks-and-ui/useCopilotReadable.md)
- **Agent & CoAgent Hooks**: [useCoAgent](4-react-hooks-and-ui/useCoAgent.md), [useCoAgentStateRender](4-react-hooks-and-ui/useCoAgentStateRender.md), [useAgent](4-react-hooks-and-ui/useAgent.md), [useAgentContext](4-react-hooks-and-ui/useAgentContext.md)
- **Tool Rendering Hooks**: [useRenderTool](4-react-hooks-and-ui/useRenderTool.md), [useRenderToolCall](4-react-hooks-and-ui/useRenderToolCall.md), [useFrontendTool](4-react-hooks-and-ui/useFrontendTool.md)
- **Prebuilt & Headless Components**: [CopilotKit Provider](4-react-hooks-and-ui/component-copilotkit.md), [CopilotChat](4-react-hooks-and-ui/component-copilot-chat.md), [CopilotSidebar](4-react-hooks-and-ui/component-copilot-sidebar.md), [CopilotPopup](4-react-hooks-and-ui/component-copilot-popup.md), [Headless UI Customization](4-react-hooks-and-ui/headless-ui.md), [CSS Styling](4-react-hooks-and-ui/custom-styling-css.md)
- **Generative UI Patterns**: [Generative UI Overview](4-react-hooks-and-ui/generative-ui-overview.md), [Tool Based UI](4-react-hooks-and-ui/generative-ui-tool-based.md), [Tool Rendering](4-react-hooks-and-ui/generative-ui-tool-rendering.md), [State Rendering](4-react-hooks-and-ui/generative-ui-state-rendering.md), [Interactive UI](4-react-hooks-and-ui/generative-ui-interactive.md), [Reasoning Display](4-react-hooks-and-ui/generative-ui-reasoning.md)

### 5. [Advanced Patterns & Workflows](5-advanced-patterns/human-in-the-loop.md) (`docs/references/copilotkit/5-advanced-patterns/`)
- **Human-In-The-Loop (HITL)**: [HITL Flow](5-advanced-patterns/human-in-the-loop.md), [useInterrupt Hook](5-advanced-patterns/useInterrupt.md), [useHumanInTheLoop Reference](5-advanced-patterns/useHumanInTheLoop.md)
- **Shared State**: [Shared State Overview](5-advanced-patterns/shared-state-overview.md), [State Streaming](5-advanced-patterns/shared-state-streaming.md), [In-App State Rendering](5-advanced-patterns/shared-state-rendering.md)
- **Multimodal & Attachments**: [Multimodal File & Image Attachments](5-advanced-patterns/multimodal-attachments.md)
- **Thread Lifecycle**: [Threads Architecture](5-advanced-patterns/threads-overview.md), [Thread Lifecycle & Persistence](5-advanced-patterns/threads-lifecycle.md), [Headless Threads](5-advanced-patterns/headless-threads.md)
- **Troubleshooting & Diagnostics**: [Common Issues](5-advanced-patterns/troubleshooting-common-issues.md), [Error Debugging](5-advanced-patterns/troubleshooting-error-debugging.md), [Error Reference](5-advanced-patterns/troubleshooting-error-reference.md)
