import operator
from typing import Annotated, Any, TypedDict

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    SystemMessage,
    ToolMessage,
)
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from src.core.config import get_llm
from src.graphs.chat.prompts import MAIN_SYSTEM_PROMPT
from src.tools.sensitive import (
    get_sensitive_tool_metadata,
    get_sensitive_tools,
    is_sensitive_tool,
)
from src.tools.system import get_default_tools


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]


async def _invoke_tool(
    tool_map: dict[str, Any],
    tool_name: str,
    tool_args: dict[str, Any],
    tool_call_id: str,
) -> ToolMessage:
    """Executes a tool from the tool map safely and returns a structured ToolMessage."""
    target_tool = tool_map.get(tool_name)
    if not target_tool:
        return ToolMessage(
            content=f"Error: Tool '{tool_name}' not found.",
            tool_call_id=tool_call_id,
            status="error",
        )
    try:
        result = await target_tool.ainvoke(tool_args)
        return ToolMessage(content=str(result), tool_call_id=tool_call_id)
    except Exception as err:
        return ToolMessage(
            content=f"Tool execution failed: {err}",
            tool_call_id=tool_call_id,
            status="error",
        )


def build_hitl_agent_graph(
    checkpointer: BaseCheckpointSaver | None = None,
    store: Any = None,
    model: Any = None,
    tools: list[Any] | None = None,
    system_prompt: str | None = None,
    **kwargs: Any,
):
    """Builds and compiles a LangGraph workflow with Human-In-The-Loop (HITL) tool execution."""
    llm = model if model is not None else get_llm()
    all_tools = list(tools if tools is not None else (get_default_tools() + get_sensitive_tools()))
    tool_map = {t.name: t for t in all_tools}
    llm_with_tools = llm.bind_tools(all_tools) if hasattr(llm, "bind_tools") else llm
    effective_checkpointer = checkpointer if checkpointer is not None else MemorySaver()
    sys_prompt = system_prompt or MAIN_SYSTEM_PROMPT

    workflow = StateGraph(AgentState)

    async def call_model(state: AgentState) -> dict[str, Any]:
        msgs = list(state["messages"])
        if not msgs or not isinstance(msgs[0], SystemMessage):
            msgs = [SystemMessage(content=sys_prompt)] + msgs
        response = await llm_with_tools.ainvoke(msgs)
        return {"messages": [response]}

    async def call_tools(state: AgentState) -> dict[str, Any]:
        last_message = state["messages"][-1]
        tool_messages: list[BaseMessage] = []

        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            for tc in last_message.tool_calls:
                tool_name = tc["name"]
                tool_args = tc.get("args", {})
                tool_call_id = tc.get("id", f"call_{tool_name}")

                # Check if tool is sensitive and requires human approval
                if is_sensitive_tool(tool_name):
                    meta = get_sensitive_tool_metadata(tool_name)
                    desc = meta.get("description") if meta else f"Execution of {tool_name}"

                    # Interrupt execution and wait for human decision
                    decision = interrupt(
                        {
                            "tool_call_id": tool_call_id,
                            "tool": tool_name,
                            "input": tool_args,
                            "description": desc,
                            "requires_approval": True,
                        }
                    )

                    # When resumed, inspect human decision
                    if isinstance(decision, dict) and decision.get("approved"):
                        tool_msg = await _invoke_tool(tool_map, tool_name, tool_args, tool_call_id)
                        tool_messages.append(tool_msg)
                    else:
                        reason = (
                            decision.get("reason")
                            if isinstance(decision, dict) and decision.get("reason")
                            else "사용자에 의해 도구 실행이 거부되었습니다."
                        )
                        tool_messages.append(
                            ToolMessage(
                                content=f"Tool execution rejected by user: {reason}",
                                tool_call_id=tool_call_id,
                                status="error",
                            )
                        )
                else:
                    # Non-sensitive tool: execute directly
                    tool_msg = await _invoke_tool(tool_map, tool_name, tool_args, tool_call_id)
                    tool_messages.append(tool_msg)

        return {"messages": tool_messages}

    def should_continue(state: AgentState) -> str:
        last_message = state["messages"][-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"
        return END

    workflow.add_node("agent", call_model)
    workflow.add_node("tools", call_tools)

    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue, ["tools", END])
    workflow.add_edge("tools", "agent")

    return workflow.compile(checkpointer=effective_checkpointer, store=store)
