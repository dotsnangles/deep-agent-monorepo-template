---
title: "useAgent"
description: "React hook for accessing AG-UI agent instances"
---

## Overview

`useAgent` is a React hook that returns an [AG-UI AbstractAgent](https://docs.ag-ui.com/sdk/js/client/abstract-agent) instance. The hook subscribes to agent state changes and triggers re-renders when the agent's state, messages, or execution status changes.

**Throws error** if no agent is configured with the specified `agentId`.

## Signature

```tsx

function useAgent(options?: UseAgentProps): {
  agent: AbstractAgent;
  isReady: boolean;
};
```

## Parameters

  Configuration object for the hook.

  ID of the agent to retrieve. Must match an agent configured in
  `CopilotKit`.

  
    Controls which agent changes trigger component re-renders. Options:
    - `UseAgentUpdate.OnMessagesChanged` - Re-render when messages change
    - `UseAgentUpdate.OnStateChanged` - Re-render when state changes
    - `UseAgentUpdate.OnRunStatusChanged` - Re-render when execution status changes

    Pass an empty array `[]` to prevent automatic re-renders.

  

## Return Value

  Object containing the agent instance and its readiness signal.

  
    The AG-UI agent instance. See [AbstractAgent documentation](https://docs.ag-ui.com/sdk/js/client/abstract-agent) for full interface details.

    ### Core Properties

    
      Unique identifier for the agent instance.
    

    
      Human-readable description of the agent's purpose.
    

    
      Unique identifier for the current conversation thread.
    

    
      Array of conversation messages. Each message contains:
      - `id: string` - Unique message identifier
      - `role: "user" | "assistant" | "system"` - Message role
      - `content: string` - Message content
    

    
      Shared state object synchronized between application and agent. Both can read and modify this state.
    

    
      Indicates whether the agent is currently executing.
    

    ### Methods

     Promise">
      Manually triggers agent execution. Resolves with a `RunAgentResult` (`{ result, newMessages }`) once the run finalizes. `result` is the final value of the run and `newMessages` are the messages produced during it.

      **Parameters:**
      - `parameters.forwardedProps?: any` - Data to pass to the agent execution context

      **Example:**
      ```tsx
      const { result, newMessages } = await agent.runAgent({
        forwardedProps: {
          command: { resume: "user response" }
        }
      });
      ```
    

     void">
      Updates the shared state. Changes are immediately available to both application and agent.

      **Example:**
      ```tsx
      agent.setState({
        ...agent.state,
        theme: "dark"
      });
      ```
    

     { unsubscribe: () => void }">
      Subscribes to agent events. Returns cleanup function.

      **Subscriber Events:**
      - `onCustomEvent?: ({ event: { name: string, value: any } }) => void` - Custom events
      - `onRunStartedEvent?: () => void` - Agent execution starts
      - `onRunFinalized?: () => void` - Agent execution completes
      - `onStateChanged?: (state: any) => void` - State changes
      - `onMessagesChanged?: (messages: Message[]) => void` - Messages added/modified
    

     void">
      Adds a single message to the conversation and notifies subscribers.
    

     void">
      Adds multiple messages to the conversation and notifies subscribers once.
    

     void">
      Replaces the entire message history with a new array of messages.
    

     void">
      Aborts the currently running agent execution.
    

     AbstractAgent">
      Creates a deep copy of the agent with cloned messages, state, and configuration.
    

  

  
    Whether `agent` is the real, runtime-synced (or locally-registered) agent
    rather than a provisional stand-in returned while the runtime is still
    connecting (or in an error state).

    `agent` is always a fully-constructed instance, so calling its methods is
    always safe. While `isReady` is `false`, the instance is a placeholder that
    is swapped for the real agent once the runtime finishes syncing — at which
    point `agent` changes reference and dependent effects re-run. Guard on
    `isReady` when you only want to act against the real agent, e.g. subscribing
    to run-lifecycle events you don't want to miss during the provisional
    window.
  

## Usage

### Basic Usage

```tsx
function AgentStatus() {
  const { agent } = useAgent();

  return (
    <div>
      <div>Agent: {agent.agentId}</div>
      <div>Messages: {agent.messages.length}</div>
      <div>Running: {agent.isRunning ? "Yes" : "No"}</div>
    </div>
  );
}
```

### Accessing and Updating State

```tsx
function StateController() {
  const { agent } = useAgent();

  return (
    <div>
      <pre>{JSON.stringify(agent.state, null, 2)}</pre>
      <button onClick={() => agent.setState({ ...agent.state, count: 1 })}>
        Update State
      </button>
    </div>
  );
}
```

### Event Subscription

```tsx
function EventListener() {
  const { agent, isReady } = useAgent();

  useEffect(() => {
    // Guard on `isReady` so the subscription lands on the real agent rather
    // than the provisional one shown while the runtime is still connecting.
    // Depending on `agent` re-subscribes automatically once the real agent
    // is bound.
    if (!isReady) return;

    const { unsubscribe } = agent.subscribe({
      onRunStartedEvent: () => console.log("Started"),
      onRunFinalized: () => console.log("Finished"),
    });

    return unsubscribe;
  }, [agent, isReady]);

  return null;
}
```

### Multiple Agents

```tsx
function MultiAgentView() {
  const { agent: primary } = useAgent({ agentId: "primary" });
  const { agent: support } = useAgent({ agentId: "support" });

  return (
    <div>
      <div>Primary: {primary.messages.length} messages</div>
      <div>Support: {support.messages.length} messages</div>
    </div>
  );
}
```

### Optimizing Re-renders

```tsx
// Only re-render when messages change
function MessageCount() {
  const { agent } = useAgent({
    updates: [UseAgentUpdate.OnMessagesChanged],
  });

  return <div>Messages: {agent.messages.length}</div>;
}
```

## Behavior

- **Automatic Re-renders**: Component re-renders when agent state, messages, or execution status changes (configurable via `updates` parameter)
- **Readiness**: While the runtime is connecting, `agent` is a fully-constructed provisional stand-in and `isReady` is `false`; once the runtime syncs, `agent` swaps to the real instance and `isReady` becomes `true`. Guard on `isReady` for work that must target the real agent (e.g. one-time subscriptions)
- **Error Handling**: Throws error if no agent exists with specified `agentId`
- **State Synchronization**: State updates via `setState()` are immediately available to both app and agent
- **Event Subscriptions**: Subscribe/unsubscribe pattern for lifecycle and custom events

## Related

- [AG-UI AbstractAgent](https://docs.ag-ui.com/sdk/js/client/abstract-agent) - Full agent interface documentation
