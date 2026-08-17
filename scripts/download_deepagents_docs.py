import os
import urllib.request
from pathlib import Path

DOCS_ROOT = Path(__file__).resolve().parent.parent / "docs" / "references"

DOC_GROUPS = {
    # 1. Deep Agents Python SDK (Official Harness)
    "deepagents": [
        ("overview.md", "https://docs.langchain.com/oss/python/deepagents/overview.md"),
        ("quickstart.md", "https://docs.langchain.com/oss/python/deepagents/quickstart.md"),
        ("customization.md", "https://docs.langchain.com/oss/python/deepagents/customization.md"),
        ("backends.md", "https://docs.langchain.com/oss/python/deepagents/backends.md"),
        ("tools.md", "https://docs.langchain.com/oss/python/deepagents/tools.md"),
        ("permissions.md", "https://docs.langchain.com/oss/python/deepagents/permissions.md"),
        ("sandboxes.md", "https://docs.langchain.com/oss/python/deepagents/sandboxes.md"),
        ("interpreters.md", "https://docs.langchain.com/oss/python/deepagents/interpreters.md"),
        ("human-in-the-loop.md", "https://docs.langchain.com/oss/python/deepagents/human-in-the-loop.md"),
        ("subagents.md", "https://docs.langchain.com/oss/python/deepagents/subagents.md"),
        ("async-subagents.md", "https://docs.langchain.com/oss/python/deepagents/async-subagents.md"),
        ("dynamic-subagents.md", "https://docs.langchain.com/oss/python/deepagents/dynamic-subagents.md"),
        ("memory.md", "https://docs.langchain.com/oss/python/deepagents/memory.md"),
        ("skills.md", "https://docs.langchain.com/oss/python/deepagents/skills.md"),
        ("context-engineering.md", "https://docs.langchain.com/oss/python/deepagents/context-engineering.md"),
        ("streaming.md", "https://docs.langchain.com/oss/python/deepagents/streaming.md"),
        ("event-streaming.md", "https://docs.langchain.com/oss/python/deepagents/event-streaming.md"),
        ("mcp.md", "https://docs.langchain.com/oss/python/deepagents/mcp.md"),
        ("models.md", "https://docs.langchain.com/oss/python/deepagents/models.md"),
        ("multimodal.md", "https://docs.langchain.com/oss/python/deepagents/multimodal.md"),
        ("profiles.md", "https://docs.langchain.com/oss/python/deepagents/profiles.md"),
        ("retrieval.md", "https://docs.langchain.com/oss/python/deepagents/retrieval.md"),
        ("rag.md", "https://docs.langchain.com/oss/python/deepagents/rag.md"),
        ("rubric.md", "https://docs.langchain.com/oss/python/deepagents/rubric.md"),
        ("fault-tolerance.md", "https://docs.langchain.com/oss/python/deepagents/fault-tolerance.md"),
        ("going-to-production.md", "https://docs.langchain.com/oss/python/deepagents/going-to-production.md"),
        ("comparison.md", "https://docs.langchain.com/oss/python/deepagents/comparison.md"),
        ("openwiki.md", "https://docs.langchain.com/oss/python/deepagents/openwiki.md"),
        ("a2a.md", "https://docs.langchain.com/oss/python/deepagents/a2a.md"),
        ("acp.md", "https://docs.langchain.com/oss/python/deepagents/acp.md"),
        ("code-link.md", "https://docs.langchain.com/oss/python/deepagents/code-link.md"),
        ("changelog-py.md", "https://docs.langchain.com/oss/python/deepagents/changelog-py.md"),
        ("changelog-js.md", "https://docs.langchain.com/oss/python/deepagents/changelog-js.md"),
        ("content-builder.md", "https://docs.langchain.com/oss/python/deepagents/content-builder.md"),
        ("data-analysis.md", "https://docs.langchain.com/oss/python/deepagents/data-analysis.md"),
        ("deep-research.md", "https://docs.langchain.com/oss/python/deepagents/deep-research.md"),
        ("frontend/overview.md", "https://docs.langchain.com/oss/python/deepagents/frontend/overview.md"),
        ("frontend/sandbox.md", "https://docs.langchain.com/oss/python/deepagents/frontend/sandbox.md"),
        ("frontend/subagent-streaming.md", "https://docs.langchain.com/oss/python/deepagents/frontend/subagent-streaming.md"),
        ("frontend/todo-list.md", "https://docs.langchain.com/oss/python/deepagents/frontend/todo-list.md"),
    ],

    # 2. Deep Agents Code (Terminal Coding Harness & Sandboxes)
    "deepagents-code": [
        ("overview.md", "https://docs.langchain.com/oss/deepagents/code/overview.md"),
        ("quickstart.md", "https://docs.langchain.com/oss/deepagents/code/quickstart.md"),
        ("configuration.md", "https://docs.langchain.com/oss/deepagents/code/configuration.md"),
        ("config-file.md", "https://docs.langchain.com/oss/deepagents/code/config-file.md"),
        ("cli-reference.md", "https://docs.langchain.com/oss/deepagents/code/cli-reference.md"),
        ("approval-modes.md", "https://docs.langchain.com/oss/deepagents/code/approval-modes.md"),
        ("credentials.md", "https://docs.langchain.com/oss/deepagents/code/credentials.md"),
        ("goals-and-rubrics.md", "https://docs.langchain.com/oss/deepagents/code/goals-and-rubrics.md"),
        ("hooks.md", "https://docs.langchain.com/oss/deepagents/code/hooks.md"),
        ("mcp-tools.md", "https://docs.langchain.com/oss/deepagents/code/mcp-tools.md"),
        ("memory-and-skills.md", "https://docs.langchain.com/oss/deepagents/code/memory-and-skills.md"),
        ("plugins.md", "https://docs.langchain.com/oss/deepagents/code/plugins.md"),
        ("providers.md", "https://docs.langchain.com/oss/deepagents/code/providers.md"),
        ("remote-sandboxes.md", "https://docs.langchain.com/oss/deepagents/code/remote-sandboxes.md"),
        ("subagents.md", "https://docs.langchain.com/oss/deepagents/code/subagents.md"),
        ("changelog.md", "https://docs.langchain.com/oss/deepagents/code/changelog.md"),
    ],

    # 3. Core Architectural Concepts & Products
    "concepts": [
        ("products.md", "https://docs.langchain.com/oss/python/concepts/products.md"),
        ("context.md", "https://docs.langchain.com/oss/python/concepts/context.md"),
        ("memory.md", "https://docs.langchain.com/oss/python/concepts/memory.md"),
        ("providers-and-models.md", "https://docs.langchain.com/oss/python/concepts/providers-and-models.md"),
    ],

    # 4. LangChain Agents, Middleware & Frontend Integrations
    "langchain-agents": [
        ("agents.md", "https://docs.langchain.com/oss/python/langchain/agents.md"),
        ("component-architecture.md", "https://docs.langchain.com/oss/python/langchain/component-architecture.md"),
        ("context-engineering.md", "https://docs.langchain.com/oss/python/langchain/context-engineering.md"),
        ("middleware/overview.md", "https://docs.langchain.com/oss/python/langchain/middleware/overview.md"),
        ("middleware/built-in.md", "https://docs.langchain.com/oss/python/langchain/middleware/built-in.md"),
        ("middleware/custom.md", "https://docs.langchain.com/oss/python/langchain/middleware/custom.md"),
        ("multi-agent/index.md", "https://docs.langchain.com/oss/python/langchain/multi-agent/index.md"),
        ("multi-agent/handoffs.md", "https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs.md"),
        ("multi-agent/router.md", "https://docs.langchain.com/oss/python/langchain/multi-agent/router.md"),
        ("multi-agent/skills.md", "https://docs.langchain.com/oss/python/langchain/multi-agent/skills.md"),
        ("multi-agent/subagents.md", "https://docs.langchain.com/oss/python/langchain/multi-agent/subagents.md"),
        ("multi-agent/custom-workflow.md", "https://docs.langchain.com/oss/python/langchain/multi-agent/custom-workflow.md"),
        ("frontend/integrations/copilotkit.md", "https://docs.langchain.com/oss/python/langchain/frontend/integrations/copilotkit.md"),
        ("frontend/integrations/assistant-ui.md", "https://docs.langchain.com/oss/python/langchain/frontend/integrations/assistant-ui.md"),
        ("frontend/integrations/ai-elements.md", "https://docs.langchain.com/oss/python/langchain/frontend/integrations/ai-elements.md"),
        ("frontend/branching-chat.md", "https://docs.langchain.com/oss/python/langchain/frontend/branching-chat.md"),
        ("frontend/time-travel.md", "https://docs.langchain.com/oss/python/langchain/frontend/time-travel.md"),
        ("frontend/join-rejoin.md", "https://docs.langchain.com/oss/python/langchain/frontend/join-rejoin.md"),
        ("frontend/generative-ui-overview.md", "https://docs.langchain.com/oss/python/langchain/frontend/generative-ui-overview.md"),
        ("frontend/controlled-generative-ui.md", "https://docs.langchain.com/oss/python/langchain/frontend/controlled-generative-ui.md"),
        ("frontend/declarative-generative-ui.md", "https://docs.langchain.com/oss/python/langchain/frontend/declarative-generative-ui.md"),
        ("frontend/open-ended-generative-ui.md", "https://docs.langchain.com/oss/python/langchain/frontend/open-ended-generative-ui.md"),
    ],

    # 5. LangGraph Runtime (StateGraph, Checkpointing, Stores, HITL)
    "langgraph-runtime": [
        ("overview.md", "https://docs.langchain.com/oss/python/langgraph/overview.md"),
        ("workflows-agents.md", "https://docs.langchain.com/oss/python/langgraph/workflows-agents.md"),
        ("graph-api.md", "https://docs.langchain.com/oss/python/langgraph/graph-api.md"),
        ("checkpointers.md", "https://docs.langchain.com/oss/python/langgraph/checkpointers.md"),
        ("stores.md", "https://docs.langchain.com/oss/python/langgraph/stores.md"),
        ("persistence.md", "https://docs.langchain.com/oss/python/langgraph/persistence.md"),
        ("interrupts.md", "https://docs.langchain.com/oss/python/langgraph/interrupts.md"),
        ("streaming.md", "https://docs.langchain.com/oss/python/langgraph/streaming.md"),
        ("event-streaming.md", "https://docs.langchain.com/oss/python/langgraph/event-streaming.md"),
        ("use-subgraphs.md", "https://docs.langchain.com/oss/python/langgraph/use-subgraphs.md"),
        ("use-time-travel.md", "https://docs.langchain.com/oss/python/langgraph/use-time-travel.md"),
        ("thinking-in-langgraph.md", "https://docs.langchain.com/oss/python/langgraph/thinking-in-langgraph.md"),
    ],
}


def download_all():
    DOCS_ROOT.mkdir(parents=True, exist_ok=True)
    headers = {"User-Agent": "Mozilla/5.0 (compatible; AppDocDownloader/1.0)"}
    total_downloaded = 0

    for group_name, files in DOC_GROUPS.items():
        group_dir = DOCS_ROOT / group_name
        group_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n--- Syncing group: {group_name} ({len(files)} files) ---")

        for rel_path, url in files:
            target_path = group_dir / rel_path
            target_path.parent.mkdir(parents=True, exist_ok=True)
            try:
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req, timeout=15) as resp:
                    content = resp.read().decode("utf-8")
                    target_path.write_text(content, encoding="utf-8")
                    total_downloaded += 1
                    print(f"  [OK] {group_name}/{rel_path} ({len(content)} bytes)")
            except Exception as e:
                print(f"  [ERR] Failed {group_name}/{rel_path}: {e}")

    # Generate master README.md in docs/references/
    master_index = [
        "# LangChain & Deep Agents Official Architecture References",
        "",
        "> Complete offline reference archive for Deep Agents, LangChain Agent Harness, Middleware, CopilotKit UI Integration, and LangGraph Runtime.",
        "> Sourced directly from https://docs.langchain.com",
        "",
        "## Documentation Sections",
        "",
        "### 1. [Deep Agents Python SDK](deepagents/README.md) (`docs/references/deepagents/`)",
        "- **Core Architecture**: [Overview](deepagents/overview.md), [Quickstart](deepagents/quickstart.md), [Customization](deepagents/customization.md), [Comparison](deepagents/comparison.md)",
        "- **Execution Environment**: [Backends](deepagents/backends.md), [Tools](deepagents/tools.md), [Permissions](deepagents/permissions.md), [Sandboxes](deepagents/sandboxes.md), [Interpreters](deepagents/interpreters.md), [MCP](deepagents/mcp.md)",
        "- **Context & Memory**: [Memory](deepagents/memory.md), [Skills](deepagents/skills.md), [Context Engineering](deepagents/context-engineering.md), [Multimodal](deepagents/multimodal.md), [OpenWiki](deepagents/openwiki.md)",
        "- **Delegation & Subagents**: [Subagents](deepagents/subagents.md), [Async Subagents](deepagents/async-subagents.md), [Dynamic Subagents](deepagents/dynamic-subagents.md)",
        "- **Steering & HITL**: [Human-In-The-Loop](deepagents/human-in-the-loop.md), [Streaming](deepagents/streaming.md), [Event Streaming](deepagents/event-streaming.md)",
        "- **Frontend Streaming**: [Todo List](deepagents/frontend/todo-list.md), [Subagent Streaming](deepagents/frontend/subagent-streaming.md), [Sandbox UI](deepagents/frontend/sandbox.md)",
        "",
        "### 2. [Deep Agents Code (CLI & Coding Harness)](deepagents-code/overview.md) (`docs/references/deepagents-code/`)",
        "- [CLI Overview](deepagents-code/overview.md), [Quickstart](deepagents-code/quickstart.md), [Configuration](deepagents-code/configuration.md), [Config File](deepagents-code/config-file.md)",
        "- [CLI Reference](deepagents-code/cli-reference.md), [Approval Modes](deepagents-code/approval-modes.md), [Hooks](deepagents-code/hooks.md), [Memory & Skills](deepagents-code/memory-and-skills.md)",
        "- [Remote Sandboxes](deepagents-code/remote-sandboxes.md), [Subagents](deepagents-code/subagents.md), [Plugins](deepagents-code/plugins.md)",
        "",
        "### 3. [Foundational Concepts](concepts/products.md) (`docs/references/concepts/`)",
        "- [Runtimes, Frameworks, and Harnesses](concepts/products.md) - Deep Agents vs. LangGraph vs. LangChain architectural relationship",
        "- [Context Engineering Overview](concepts/context.md) - Managing agent context lifecycle",
        "- [Memory Architecture](concepts/memory.md) - Short-term vs. Long-term memory models",
        "- [Providers and Models](concepts/providers-and-models.md) - LLM provider integrations",
        "",
        "### 4. [LangChain Agents & Middleware](langchain-agents/agents.md) (`docs/references/langchain-agents/`)",
        "- **Middleware Architecture**: [Overview](langchain-agents/middleware/overview.md), [Prebuilt Middleware](langchain-agents/middleware/built-in.md) (TodoList, Summarization, Context Offload), [Custom Middleware](langchain-agents/middleware/custom.md)",
        "- **Frontend & CopilotKit**: [CopilotKit Integration Guide](langchain-agents/frontend/integrations/copilotkit.md), [Generative UI Overview](langchain-agents/frontend/generative-ui-overview.md), [Controlled Generative UI](langchain-agents/frontend/controlled-generative-ui.md)",
        "- **Chat UX**: [Branching Chat](langchain-agents/frontend/branching-chat.md), [Time Travel](langchain-agents/frontend/time-travel.md), [Join/Rejoin Streams](langchain-agents/frontend/join-rejoin.md)",
        "- **Multi-Agent Patterns**: [Multi-Agent Overview](langchain-agents/multi-agent/index.md), [Handoffs](langchain-agents/multi-agent/handoffs.md), [Router](langchain-agents/multi-agent/router.md), [Subagents](langchain-agents/multi-agent/subagents.md)",
        "",
        "### 5. [LangGraph Runtime](langgraph-runtime/overview.md) (`docs/references/langgraph-runtime/`)",
        "- [StateGraph & Workflows](langgraph-runtime/workflows-agents.md), [Graph API](langgraph-runtime/graph-api.md)",
        "- [Checkpointers (Persistence)](langgraph-runtime/checkpointers.md), [Stores (Long-term Store)](langgraph-runtime/stores.md)",
        "- [Interrupts & Human-In-The-Loop](langgraph-runtime/interrupts.md), [Streaming & astream_events](langgraph-runtime/streaming.md)",
        "- [Subgraphs](langgraph-runtime/use-subgraphs.md), [Thinking in LangGraph](langgraph-runtime/thinking-in-langgraph.md)",
    ]

    (DOCS_ROOT / "README.md").write_text("\n".join(master_index), encoding="utf-8")
    print(f"\n[ALL DONE] Total {total_downloaded} files synced to: {DOCS_ROOT}")


if __name__ == "__main__":
    download_all()
