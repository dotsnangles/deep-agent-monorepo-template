---
title: "LangGraphAgent"
description: "LangGraphAgent lets you define your agent for use with CopilotKit."
---

{
 /*
  * ATTENTION! DO NOT MODIFY THIS FILE!
  * This page is auto-generated. If you want to make any changes to this page, changes must be made at:
  * sdk-python/copilotkit/langgraph_agent.py
  */
}
## LangGraphAgent

LangGraphAgent lets you define your agent for use with CopilotKit.

    To install, run:

    ```bash
    pip install copilotkit
    ```

    ### Examples

    Every agent must have the `name` and `graph` properties defined. An optional `description`
    can also be provided. This is used when CopilotKit is dynamically routing requests to the
    agent.

    ```python
    from copilotkit import LangGraphAgent

    LangGraphAgent(
        name="email_agent",
        description="This agent sends emails",
        graph=graph,
    )
    ```

    If you have a custom LangGraph/LangChain config that you want to use with the agent, you can
    pass it in as the `langgraph_config` parameter.

    ```python
    LangGraphAgent(
        ...
        langgraph_config=config,
    )
    ```

### Parameters

 
The name of the agent.

 
The LangGraph graph to use with the agent.

 
The description of the agent.

 
The LangGraph/LangChain config to use with the agent.

 
The CopilotKit config to use with the agent.

## CopilotKitConfig

CopilotKit config for LangGraphAgent

    This is used for advanced cases where you want to customize how CopilotKit interacts with
    LangGraph.

    ```python
    # Function signatures:
    def merge_state(
        *,
        state: dict,
        messages: List[BaseMessage],
        actions: List[Any],
        agent_name: str
    ):
        # ...implementation...

    def convert_messages(messages: List[Message]):
        # ...implementation...
    ```

### Parameters

 
This function lets you customize how CopilotKit merges the agent state.

 
Use this function to customize how CopilotKit converts its messages to LangChain messages.`
