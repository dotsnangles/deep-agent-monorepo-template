---
title: Common Copilot Issues
description: Network errors, endpoint not found, tunnel timeouts, and other common issues when wiring up CopilotKit with the Built-in Agent.
frontend: universal
---

Welcome to the CopilotKit troubleshooting guide. This page covers the most common issues you'll hit while wiring up a Built-in Agent, plus the usual fixes.

> [!NOTE]
> Have an issue not listed here? Open a ticket on [GitHub](https://github.com/CopilotKit/CopilotKit/issues) or reach out on [Discord](https://discord.com/invite/6dffbvGU3D) and we'll help. PRs adding your own troubleshooting notes are very welcome.

## Network errors / API not found

If you're getting network or API errors, here's how to troubleshoot.

Verify the configured `runtimeUrl`.

```tsx

  {/* Your app */}

```

Or, if you're using CopilotCloud:

```tsx
">
  {/* Your app */}

```

Common issues:

- Missing leading slash in the endpoint path
- Wrong path relative to your app's base URL (or, if absolute, wrong full URL)
- Typos in the endpoint path

- Using CopilotCloud but also setting `runtimeUrl`. Omit `runtimeUrl` and keep only `publicApiKey`

If you're running locally and getting connection errors, try `127.0.0.1` instead of `localhost`:

```bash
# If this doesn't work:
http://localhost:3000/api/copilotkit

# Try this instead:
http://127.0.0.1:3000/api/copilotkit
```

Usually caused by local DNS / `/etc/hosts` issues.

Make sure your backend:

- Is actually running on the port you expect
- Is reachable from your frontend
- Isn't blocked by CORS or a firewall

Revisit the [quickstart](../quickstart) if you want to double-check your setup.

## "Remote Endpoint not found" error

If you're getting a *"CopilotKit's Remote Endpoint not found"* error, the `/info` endpoint isn't reachable from the runtime.

Confirm the CopilotKit SDK is mounted. If you're using Python + FastAPI, follow the [Remote Python Endpoint](/reference/v1/sdk/python/RemoteEndpoints) guide.

```bash
curl -v -d '{}' http://localhost:8000/copilotkit/info
```

You should see a `200 OK` and a JSON body like:

```json
{
  "actions": [],
  "agents": [
    { "name": "my_agent", "description": "A helpful agent.", "type": "langgraph_agui" }
  ],
  "sdkVersion": "0.1.32"
}
```

If you see a different response, check your server logs.

## Tunnel creation hangs

If the tunnel creation process spins indefinitely, your router or ISP might be blocking the tunnel service.

Verify connectivity:

```bash
ping tunnels.devcopilotkit.com
curl -I https://tunnels.devcopilotkit.com
telnet tunnels.devcopilotkit.com 443
```

If any of these fail:

- Check your router security settings
- Contact your ISP to see if they're blocking the connection
- Try a different network to confirm

## The Built-in Agent responds with an empty message

Usually one of:

- The LLM model string isn't supported by the runtime's provider. Check it against [Model Selection](/model-selection).
- The Built-in Agent's `prompt` is empty and the user message gives it nothing useful to do. Give the agent a system prompt.
- A frontend tool is throwing during its handler and the agent is treating the empty result as the turn output. See [Error Debugging](./error-debugging) for the `tool_handler_failed` code.

## Tools I registered don't show up

- Open the [Inspector](../inspector) > **Frontend Tools** panel. If the tool isn't there, the hook call didn't land. Confirm the component is actually mounted.
- If the tool is listed but the agent never calls it, the model may not know when to use it. Tweak the `description` to include the trigger phrase.
- For v1 to v2 migrations, `useCopilotAction` split into `useFrontendTool`, `useComponent`, and `useHumanInTheLoop`. Make sure you're using the right one.

## Connect route returns 404 on a fresh thread

If you self-host the runtime and see a `404` from `POST /agent/:agentId/connect`
right after the page loads, before any message is sent, it's almost always one
of two things:

The runtime returns a `404` with this body when no agent matches the id in the URL:

```json
{ "error": "Agent not found", "message": "Agent 'default' does not exist" }
```

The prebuilt components connect to the agent named `"default"` unless you pass an
explicit `agentId`. Register one under that key:

```ts
new CopilotRuntime({ agents: { default: myAgent } });
```

Confirm the agent shows up by hitting [`GET {runtimeUrl}/info`](/backend/runtime-endpoints)
directly. See also the [error reference](./error-reference#agent-not-found--agent-id-does-not-exist).

The frontend mints a thread id and may call `connect()` to re-attach **before**
the first `run()` has produced any events. A persistence backend that only learns
about a thread once a run starts can 404 (or error) on that first connect.

The built-in [`InMemoryAgentRunner`](/backend/agent-runner) handles the common
cases, but a custom runner backed by an external memory layer must handle the
"unknown thread" path explicitly. Return an empty `RUN_STARTED`,
`MESSAGES_SNAPSHOT`, `RUN_FINISHED` sequence instead of failing. The
[AWS AgentCore integration](/deploy/agentcore) shows the exact pattern.

## Runtime memory keeps growing or the process runs out of heap

A long-lived server on the default `InMemoryAgentRunner` accumulates thread
history in process memory.

The store is bounded by default (1000 threads, 100 runs per thread, ~512 MiB of
retained history), but those defaults assume a reasonably sized heap. If your
process runs with a small `--max-old-space-size`, or your threads carry unusually
large payloads, lower the limits:

```ts
new InMemoryAgentRunner({ maxThreads: 200, maxBytes: 64 * 1024 ** 2 });
```

See [bounding in-memory history](/backend/agent-runner#bounding-in-memory-history)
for what each bound covers and what it deliberately does not.

`InMemoryAgentRunner evicted in-memory thread history...` means the bounds are
doing their job — the process is safe, but that thread's scrollback is gone and
will not come back. If losing history matters, move to a durable runner:
[Self-Hosting Enterprise Intelligence](/premium/self-hosting), or your own
[custom runner](/backend/agent-runner#extending-a-runner-for-a-custom-backend)
backed by your datastore.
