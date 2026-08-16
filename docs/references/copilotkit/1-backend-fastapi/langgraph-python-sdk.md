---
title: "LangGraph SDK"
description: "The CopilotKit LangGraph SDK for Python allows you to build and run LangGraph workflows with CopilotKit."
---

{
 /*
  * ATTENTION! DO NOT MODIFY THIS FILE!
  * This page is auto-generated. If you want to make any changes to this page, changes must be made at:
  * sdk-python/copilotkit/langgraph.py
  */
}
## copilotkit_customize_config

Customize the LangGraph configuration for use in CopilotKit.

    To install the CopilotKit SDK, run:

    ```bash
    pip install copilotkit
    ```

    ### Examples

    Disable emitting messages and tool calls:
    
    ```python
    from copilotkit.langgraph import copilotkit_customize_config

    config = copilotkit_customize_config(
        config,
        emit_messages=False,
        emit_tool_calls=False
    )
    ```

    To emit a tool call as streaming LangGraph state, pass the destination key in state,
    the tool name and optionally the tool argument. (If you don't pass the argument name,
    all arguments are emitted under the state key.)

    ```python
    from copilotkit.langgraph import copilotkit_customize_config

    config = copilotkit_customize_config(
        config,
        emit_intermediate_state=[
           {
                "state_key": "steps",
                "tool": "SearchTool",
                "tool_argument": "steps"
            },
        ]
    )
    ```

### Parameters

 
The LangChain/LangGraph configuration to customize. Pass None to make a new configuration.

 
Configure how messages are emitted. By default, all messages are emitted. Pass False to disable emitting messages.

 
Configure how tool calls are emitted. By default, all tool calls are emitted. Pass False to disable emitting tool calls. Pass a string or list of strings to emit only specific tool calls.

 
Lets you emit tool calls as streaming LangGraph state.

### Returns

The customized LangGraph configuration.

## copilotkit_exit

Exits the current agent after the run completes. Calling copilotkit_exit() will
    not immediately stop the agent. Instead, it signals to CopilotKit to stop the agent after
    the run completes.

    ### Examples

    ```python
    from copilotkit.langgraph import copilotkit_exit

    def my_node(state: Any):
        await copilotkit_exit(config)
        return state
    ```

### Parameters

 
The LangGraph configuration.

### Returns

Always return True.

## copilotkit_emit_state

Emits intermediate state to CopilotKit. Useful if you have a longer running node and you want to
    update the user with the current state of the node.

    ### Examples

    ```python
    from copilotkit.langgraph import copilotkit_emit_state

    for i in range(10):
        await some_long_running_operation(i)
        await copilotkit_emit_state(config, {"progress": i})
    ```

### Parameters

 
The LangGraph configuration.

 
The state to emit (Must be JSON serializable).

### Returns

Always return True.

## copilotkit_emit_message

Manually emits a message to CopilotKit. Useful in longer running nodes to update the user.
    Important: You still need to return the messages from the node.

    ### Examples

    ```python
    from copilotkit.langgraph import copilotkit_emit_message

    message = "Step 1 of 10 complete"
    await copilotkit_emit_message(config, message)

    # Return the message from the node
    return {
        "messages": [AIMessage(content=message)]
    }
    ```

### Parameters

 
The LangGraph configuration.

 
The message to emit.

### Returns

Always return True.

## copilotkit_emit_tool_call

Manually emits a tool call to CopilotKit.

    ```python
    from copilotkit.langgraph import copilotkit_emit_tool_call

    await copilotkit_emit_tool_call(config, name="SearchTool", args={"steps": 10})
    ```

### Parameters

 
The LangGraph configuration.

 
The name of the tool to emit.

 
The arguments to emit.

### Returns

Always return True.
