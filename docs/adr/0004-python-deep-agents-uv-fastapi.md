# 4. Python Deep Agents Stack with uv and FastAPI

Date: 2026-08-15

## Status

Accepted

## Context

The application requires intelligent autonomous agent workflows, tools, and real-time interactive AI copilot features. A Python ecosystem provides the richest deep agent frameworks (LangGraph, LangChain, DeepAgents).

## Decision

1. Create a dedicated Python application in `apps/agent` using `uv` package manager (`pyproject.toml`, `uv.lock`).
2. Build the API layer using FastAPI to handle REST endpoints, streaming SSE, and agent runtime endpoints.

## Consequences

- Clean separation between Node.js server (`apps/server`) and Python Agent server (`apps/agent`).
- Blazing fast dependency installation and virtual environment management via `uv`.
