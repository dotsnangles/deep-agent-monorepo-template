# 23. Declarative Agent Configuration and Externalized Prompt Catalog

Date: 2026-08-17

## Status
Accepted

## Context
1. **Template Portability Need**: The Deep Agent harness (`apps/agent`) provides production-grade capabilities (dual-environment profiles, general-purpose subagents, rubric quality gates, fault-tolerance call limits, and context compaction). However, critical agent behaviors (model selection, token safety caps, middleware toggles, backend storage routes) and system instructions were hardcoded across Python source files (`src/core/config.py`, `src/graphs/chat/prompts.py`, `src/graphs/chat/factory.py`).
2. **Developer & Prompt Engineer Ergonomics**: To serve as a versatile, reusable template for new AI agent projects, engineers and prompt designers must be able to customize behavior, tune safety limits, and iterate on system prompts without editing deep Python orchestration logic.
3. **Multi-Source Configuration Precedence**: The configuration engine must cleanly resolve settings across code overrides, environment variables (`.env`), YAML configuration files (`agent.config.yaml`), and built-in defaults without breaking existing unit tests or backward compatibility.

## Decision
1. **Declarative Configuration File (`agent.config.yaml`)**:
   - Provide a root `apps/agent/agent.config.yaml` specifying environment profiles, model endpoints, fallback models, call limits, subagent toggles, rubric evaluation rules, and backend route mappings.
2. **Type-Safe Validation with Pydantic (`AgentConfigLoader`)**:
   - Introduce `AgentConfig` (Pydantic model) in `src/core/settings.py` (or `src/core/config.py`) to parse, validate, and provide strong typing with fail-fast startup errors for misconfigured YAMLs.
   - Enforce explicit precedence order:
     `Explicit Code Arguments > Environment Variables (.env) > YAML Configuration (agent.config.yaml) > Built-in Defaults`.
3. **Externalized Markdown Prompt Catalog (`prompts/*.md`)**:
   - Separate raw prompt strings into discrete Markdown files under `apps/agent/prompts/`:
     - `system_prompt.md`: Base system instructions and persona.
     - `title_prompt.md`: Conversation summary prompt.
     - `rubric.md`: Quality gate evaluation instructions.
   - Provide a lightweight `PromptCatalog` loader that handles variable placeholders and safe string substitution.
4. **100% Backward-Compatible Factory Integration**:
   - `DeepAgentEnvironmentFactory.create_agent()` resolves its parameters via `AgentConfigLoader` and `PromptCatalog` by default, while allowing explicit keyword argument overrides to take precedence.

## Consequences
- **Positive**:
  - **Zero-Code Agent Customization**: Developers can spin up new agent variants simply by modifying `agent.config.yaml` and editing Markdown prompt files.
  - **Clean Prompt Engineering Workflow**: Prompt changes can be versioned, reviewed, and diffed cleanly in dedicated Markdown documents without touching Python code.
  - **Fail-Fast Validation**: Schema errors in YAML are caught immediately at initialization with informative Pydantic error traces.
- **Negative / Trade-offs**:
  - Adds a small file I/O overhead at initialization (mitigated by caching in production).
