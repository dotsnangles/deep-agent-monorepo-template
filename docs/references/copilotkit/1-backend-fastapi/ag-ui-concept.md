---
title: "Connect AG-UI agents"
description: "How CopilotKit connects any supported frontend and agent framework through AG-UI."
---

CopilotKit is built on the [AG-UI protocol](https://ag-ui.com), a lightweight,
event-based standard that defines how AI agents communicate with user-facing
applications over Server-Sent Events (SSE).

Messages, state updates, tool calls, and agent lifecycle events all flow
through AG-UI. Understanding this layer helps you debug and extend any
CopilotKit integration.

## Accessing your agent with `useAgent`

`useAgent` returns the AG-UI `AbstractAgent` behind your copilot:

```tsx

function AgentStatus() {
  const { agent } = useAgent({ agentId: "research-agent" });

  // agent.messages  — conversation history
  // agent.state     — current shared state
  // agent.isRunning — whether the agent is running
}
```

The resolved agent is a standard AG-UI `AbstractAgent`. You can read its
state, invoke protocol methods, and subscribe to its event stream.

### Subscribing to AG-UI events

Subscribe in an effect and unsubscribe when the component unmounts:

```tsx

function EventLog() {
  const { agent } = useAgent({ agentId: "research-agent" });

  useEffect(() => {
    const subscription = agent.subscribe({
      onTextMessageContentEvent({ textMessageBuffer }) {
        console.log("Streaming text:", textMessageBuffer);
      },
      onToolCallEndEvent({ toolCallName, toolCallArgs }) {
        console.log("Tool called:", toolCallName, toolCallArgs);
      },
      onStateChanged({ agent }) {
        console.log("State changed:", agent.state);
      },
    });
    return () => subscription.unsubscribe();
  }, [agent]);
}
```

The callback names map directly to the [AG-UI event
types](https://docs.ag-ui.com/concepts/events):

| Event | Callback |
| --- | --- |
| Run lifecycle | `onRunStartedEvent`, `onRunFinishedEvent`, `onRunErrorEvent` |
| Steps | `onStepStartedEvent`, `onStepFinishedEvent` |
| Text messages | `onTextMessageStartEvent`, `onTextMessageContentEvent`, `onTextMessageEndEvent` |
| Tool calls | `onToolCallStartEvent`, `onToolCallArgsEvent`, `onToolCallEndEvent`, `onToolCallResultEvent` |
| State | `onStateSnapshotEvent`, `onStateDeltaEvent` |
| Messages | `onMessagesSnapshotEvent` |
| Custom | `onCustomEvent`, `onRawEvent` |
| High-level changes | `onMessagesChanged`, `onStateChanged` |

## The proxy pattern

When you use CopilotKit with a runtime, your frontend does not talk directly
to the backend agent. CopilotKit discovers agents through the runtime's
`/info` endpoint and represents each one with a proxy that implements the
same `AbstractAgent` interface.

```tsx title="What your component sees"
const { agent } = useAgent();
agent.messages;
agent.state;
agent.subscribe({ /* … */ });
```

```tsx title="What happens underneath"
// useAgent() → registry checks /info → resolves a proxy agent
// agent.runAgent() → runtime POST → agent execution → SSE events
```

This indirection lets the runtime provide authentication, middleware, agent
routing, and CopilotKit Enterprise Intelligence without changing how the
frontend interacts with agents.

## How agents slot into the runtime

On the server, `CopilotRuntime` accepts a map of AG-UI `AbstractAgent`
instances. A framework adapter, an `HttpAgent` pointing at a remote server,
and a custom implementation all use the same request path:

1. The runtime resolves the target agent by ID.
2. It clones the agent for request isolation and supplies messages, state, and
   thread context.
3. `AgentRunner` executes the agent and receives AG-UI events.
4. The runtime encodes those events as SSE and streams them to the frontend
   proxy.

The backend framework can change without forcing a corresponding change to
the frontend AG-UI contract.
