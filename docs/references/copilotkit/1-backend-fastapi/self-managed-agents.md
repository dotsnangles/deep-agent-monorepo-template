---
title: "Self-managed agents"
description: "Connect AG-UI agents that you host and secure yourself."
---

The frontend provider usually talks to your agents through the
[runtime](/backend/copilot-runtime): the frontend hits `runtimeUrl`, the runtime
discovers agents from `/info`, and a proxy forwards every run server-side. But you
can also hand the provider **AG-UI agent instances directly** and skip the runtime
for those agents. There are separate production and local-development options,
and choosing the right one matters.

## Production: self-managed agents

`selfManagedAgents` is the supported configuration option for connecting agents you manage
yourself, for example an [`HttpAgent`](/backend/ag-ui) pointing at an
AG-UI-compatible backend you own and have already secured:

> [!NOTE]
> `selfManagedAgents` is part of CopilotKit's [Enterprise
>   Intelligence](/premium/intelligence-platform) offering. [Talk to an
>   engineer](https://copilotkit.ai/talk-to-an-engineer) about licensing for
>   production use.

```tsx

const supportAgent = new HttpAgent({
  url: "https://agents.example.com/support",
});

  
;
```

Each key is the `agentId` that chat components and frontend agent APIs use to
address that agent. Self-managed agents use your transport and your security
model. Because the requests don't pass through the CopilotKit runtime, the
runtime's server-side auth, middleware, and routing do not apply. Your agent
endpoint must authenticate and authorize every request.

> [!NOTE]
> You can combine `selfManagedAgents` with `runtimeUrl`. Runtime-discovered agents
> and self-managed agents coexist; address each by its `agentId`.

## Development: local agents

`agents__unsafe_dev_only` accepts the same shape: a map of `agentId` to
`AbstractAgent`. The name is intentionally loud. Use it only for local
development and prototyping.

```tsx

const myAgent = new HttpAgent({ url: "http://localhost:8000" });

  
;
```

Reach for it when you're wiring up an agent locally and don't want to stand up a
runtime yet. Don't ship it to production. Switch to `selfManagedAgents` if you
intend to manage and secure the connection yourself, or move the agent behind the
[runtime](/backend/copilot-runtime).

## How they relate

Both sources feed the same client-side agent registry. When both are supplied
they are merged, and **`selfManagedAgents` wins on a key collision**:

```ts
// effective agents ≈ { ...agents__unsafe_dev_only, ...selfManagedAgents }
```

Supplying agents through either provider option also satisfies the frontend
configuration check when at least one local agent is registered.

You won't get the
`Missing required prop: 'runtimeUrl' or 'publicApiKey' or 'publicLicenseKey'`
error; see the [error reference](/troubleshooting/error-reference).

| | `selfManagedAgents` | Local agents |
|---|---|---|
| **Intended for** | Production, agents you manage | Local dev / prototyping |
| **Auth** | Your responsibility | Your responsibility |
| **Runtime middleware / routing** | Not applied | Not applied |
| **Precedence on collision** | Wins | Overridden by `selfManagedAgents` |

## Related

- [Copilot Runtime](/backend/copilot-runtime): the recommended runtime-backed path and its trade-offs compared with direct connections.
- [Connect AG-UI agents](/backend/ag-ui): the `AbstractAgent` / `HttpAgent` interface these options accept.
- [Auth](/auth): securing agent traffic when you self-manage the connection.
