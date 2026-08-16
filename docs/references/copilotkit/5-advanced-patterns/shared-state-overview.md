---
title: Shared State
description: Create a two-way connection between your UI and agent state.
---
## What is shared state?

Agentic Copilots maintain a shared state that seamlessly connects your UI with the agent's execution. This shared state system allows you to:

- Display the agent's current progress and intermediate results
- Update the agent's state through UI interactions
- React to state changes in real-time across your application

## When should I use this?

Use shared state when you want the agent and the user to collaborate through the
same application state. The agent's outputs are reflected in the UI, and user
updates in the UI are reflected in the agent's execution.

## Reading agent state

Subscribe a component to the agent's state with `useAgent`. Any time the agent
mutates its state, for example via a tool call, the hook fires and your UI
re-renders with the new values.

The returned `agent.state` is just a plain object. Read it like any other
piece of React state and render the parts you care about: agent-written
notes, structured outputs, progress indicators, anything the agent has put
there.

## Writing agent state

The same `agent` object exposes a `setState` setter. Calling it from a UI
event handler pushes the new value into shared state, and the agent reads it
back on its next turn. The UI's writes visibly steer the model.

This is what makes the channel two-way: the UI doesn't just observe the
agent, it can hand the agent fresh inputs (preferences, selections, partial
work) without going through the chat thread.

## Rendering shared state in the UI

Because `agent.state` is plain React data, the UI layer is whatever you'd
normally build. The demo on this page wires the agent's outputs into a
small card component and feeds user edits back through `setState`.

Nothing about this is chat-specific: `useAgent` works in any component under
``, so you can render `agent.state` in your main view or canvas,
not just inside the chat panel. See
**[Render agent state in your app](/shared-state/rendering-in-app)** for the
full main-view pattern.

## Streaming partial state updates

By default, agent state only updates *between* backend checkpoints, so a
long-running tool call appears as one big burst at the end. State streaming
forwards a specific tool argument straight into a state key *as it's being
generated*, so the UI can watch the answer assemble token-by-token.

See **[State streaming](/shared-state/streaming)** for the full walkthrough,
including the corresponding `useAgent` subscription on the frontend.

## Read-only context

When the value is **UI-owned** and the agent should read it but never write
it back, such as current user, selected record, or scroll position, reach for
`useAgentContext` instead of full shared state. It publishes values as a
one-way UI-to-agent channel that auto-unregisters on unmount.

See **[Agent read-only context](/shared-state/agent-readonly)** for the
full pattern.
