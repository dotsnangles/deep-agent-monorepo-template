# 5. CopilotKit Integration with Langfuse Observability & Ollama

Date: 2026-08-15

## Status

Accepted

## Context

The agent stack requires interactive UI components in Next.js, observability/tracing for debugging agent reasoning steps, and local LLM inference for cost-effective development.

## Decision

1. Use **CopilotKit** (`@copilotkit/react-core`, `@copilotkit/react-ui`) in `apps/web` connected to `apps/agent` Remote Endpoint.
2. Integrate **Langfuse** (`langfuse-python` SDK) for agent tracing, prompt logging, and latency evaluation.
3. Use local **Ollama** (`gemma4:e4b-it-q4_K_M` model on `http://localhost:11434`) during development, with environment variable switching to OpenAI/Anthropic/Gemini APIs in production.

## Consequences

- Full in-app AI Copilot capability with sidebar and in-app actions.
- Complete visibility into agent execution traces via Langfuse.
- Free, privacy-preserving local LLM development via Ollama.
