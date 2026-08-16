# 22. Dual-Environment Inference Concurrency and Deep Agent Factory

Date: 2026-08-16

## Status
Accepted

## Context
1. **Local SLM Compute & Concurrency Bottleneck**: When developing locally with small language models (SLMs via Ollama, e.g., 4B/7B quantized weights on consumer GPUs/CPUs), the system is vulnerable to hardware crashes (OOM, scheduler locks, process hang) whenever **concurrent parallel inferences** occur (e.g., streaming interactive chat while a background Title Worker or SubAgent fan-out concurrently hits Ollama).
2. **Production Cloud Scalability Duality**: In production or high-spec cloud environments, models (Claude 3.5/4.6, GPT-4o/5.5, Gemini 2.5/3.6) support high concurrency, parallel subagent swarms, LLM-as-a-judge rubric verification loops, prompt caching, and multi-tier storage backends.
3. **Configuration & Harness Seam Need**: The agent service requires a clean, environment-aware abstraction so that local zero-cost SLM development runs under strict Single-Flight Inference safety without crippling the advanced capabilities when deployed to cloud multi-LLM infrastructure.

## Decision
1. **Dual-Environment Presets (`DEEP_AGENT_MODE`)**:
   - Introduce `DEEP_AGENT_MODE=local_slm | cloud_provider` in `src/core/config.py` (defaulting to `local_slm` when `LLM_PROVIDER=ollama`).
   - Allow hybrid configuration where the preset defines safe baseline defaults while individual flags (`ENABLE_SUBAGENTS`, `LLM_CONCURRENCY_LIMIT`) can be overridden.
2. **Two-Tier Concurrency Protection for Local SLM**:
   - **Functional Defense**: In `local_slm` mode, disable multi-agent fan-out (`ENABLE_SUBAGENTS=false`), disable rubric iterative grading loops, and use `Heuristic Title Strategy` (`user_prompt[:25]`) to bypass background LLM generation entirely.
   - **Hardware Serialization Guard**: Introduce an `Inference Serialization Gateway` (`asyncio.Semaphore(1)`) ensuring that even unexpected concurrent requests are strictly queued FIFO rather than hitting Ollama in parallel.
3. **Environment-Aware Deep Agent Factory (`src/graphs/chat/factory.py`)**:
   - In `local_slm` mode: Register a tailored `HarnessProfile` (concise suffix, `excluded_tools={"execute", "delete"}` when sandbox is not required), lightweight `CompositeBackend` (`StateBackend` default + sandboxed workspace), and defensive call limits.
   - In `cloud_provider` mode: Register provider profiles, multi-tier `CompositeBackend` (`StoreBackend` for cross-thread memory + `DockerSandboxBackend`), specialized declarative subagents, fault-tolerant retry/fallback middlewares, and prompt caching.
4. **Seamless Compatibility Seam**:
   - Maintain `build_agent()` in `src/graphs/chat/graph.py` as the public entry point, internally delegating graph compilation to `DeepAgentEnvironmentFactory` to ensure 100% backward compatibility with existing routes and tests.

## Consequences
- **Positive**:
  - **Zero Local Ollama Crashes**: Eliminates parallel inference OOMs and scheduler hangs on local developer machines.
  - **Zero Cost & Instant Titles**: Eliminates background LLM queue contention during chat streaming in local development.
  - **Seamless Cloud Scale-Out**: Flipping to `cloud_provider` unlocks full subagent swarms, cross-session long-term memory, and LLM-as-a-judge evaluation without changing application code.
  - **Clean Architectural Seam**: Keeps the agent harness modular, testable, and deeply aligned with LangChain Deep Agents best practices.
- **Negative / Trade-offs**:
  - Local mode limits subagent features by default; developers wanting to test complex subagent trees locally must explicitly opt-in via `ENABLE_SUBAGENTS=true` and accept queue serialization delays.
