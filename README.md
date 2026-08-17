# AI Deep Agent Monorepo Template

A production-grade, full-stack AI Deep Agent monorepo template engineered for conversational AI applications, multimodal file attachments, isolated code execution sandboxes, and full-lifecycle LLM observability.

---

## 1. Overview and Purpose

This repository provides a complete, batteries-included foundation for developing and deploying autonomous AI agents and enterprise chat platforms. It decouples core business logic, web interfaces, and agent orchestration into modular packages within an Nx-managed TypeScript and Python workspace.

### Core Philosophy

1. **Zero-Cost Local Development**
   Pre-configured for local Small Language Models (SLMs) via Ollama with zero external API fees, single-flight inference locking to prevent out-of-memory errors, and zero-latency heuristic title workers.

2. **Production-Ready Scalability**
   Architected for seamless transition to cloud LLM providers (OpenAI, Anthropic, Google Gemini), AWS S3 object storage, managed PostgreSQL, and distributed Redis event streaming.

3. **Complete Infrastructure Out-of-the-Box**
   PostgreSQL 18, Redis 7, MinIO S3 Object Storage, ClickHouse, Langfuse v3 LLM Observability, and Docker Sandbox Runner pre-configured in Docker Compose with automatic bucket and schema provisioning.

4. **Clean Monorepo Boundaries**
   Strict domain-driven package hierarchy with 100% upstream-aligned shadcn/ui primitives, Drizzle ORM transaction-safe repository patterns, and end-to-end type safety.

---

## 2. System Architecture

```text
+-------------------------------------------------------------------------------+
|                               Frontend Layer                                  |
|  apps/web (Next.js 16 App Router, Turbopack, TailwindCSS, CopilotKit UI)      |
+-------------------------------------------------------------------------------+
       |                                                    |
       | REST / Auth / Session Queries                      | AG-UI / SSE Stream
       v                                                    v
+-----------------------------+        +----------------------------------------+
|       Backend Server        |        |              Agent Server              |
|  apps/server (Node/Express) |        |  apps/agent (Python 3.13, FastAPI)     |
|  - Better-Auth handler      |        |  - LangChain deepagents & LangGraph    |
|  - Drizzle ORM repositories |        |  - Dual-mode (Local SLM / Cloud LLM)   |
+-----------------------------+        |  - Langfuse Tracing & Redis Pub/Sub    |
                                       +----------------------------------------+
                                                    |
                                                    | Code execution
                                                    v
                                       +----------------------------------------+
                                       |          Sandbox Runner                |
                                       |  Isolated Docker execution container   |
                                       +----------------------------------------+
```

### Directory Structure

```text
.
├── apps/
│   ├── web/               # Next.js 16 frontend application
│   ├── server/            # Express REST API & authentication server
│   └── agent/             # Python FastAPI agent server (LangChain deepagents)
├── packages/
│   ├── ui/                # Shared shadcn/ui components and design tokens
│   ├── db/                # Drizzle ORM schema, migrations, and ChatRepository
│   ├── auth/              # Better-Auth configuration
│   ├── redis/             # Redis client and Pub/Sub event subscriber
│   ├── storage/           # MinIO / AWS S3 client and presigned URL gateway
│   ├── validators/        # Shared Zod validation schemas and DTOs
│   ├── env/               # Type-safe environment validation (@t3-oss/env)
│   └── config/            # Shared TypeScript and ESLint configurations
├── docs/                  # Architecture Decision Records (ADRs) and domain docs
└── docker-compose.yml     # Multi-service infrastructure orchestration
```

---

## 3. Prerequisites

Ensure the following tools are installed on your host system:

- **Node.js**: `v20.x` or higher
- **pnpm**: `v9.x` or higher (`corepack enable` or `npm install -g pnpm`)
- **Python**: `3.13` or higher
- **uv**: Fast Python package installer (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Docker & Docker Compose**: Docker Desktop or Docker Engine with Compose V2
- **Ollama** (Optional for local inference): [ollama.ai](https://ollama.ai)

---

## 4. Getting Started

Follow these steps to run the complete stack locally.

### Step 1: Clone Repository and Install Dependencies

```bash
git clone https://github.com/<your-org>/<your-repo-name>.git
cd <your-repo-name>

# Install workspace JavaScript/TypeScript dependencies
pnpm install

# Install Python agent dependencies
cd apps/agent && uv sync && cd ../..
```

### Step 2: Start Infrastructure Services

Start the backing infrastructure containers (PostgreSQL, Redis, MinIO, ClickHouse, Langfuse, Langfuse Worker, and Sandbox Runner):

```bash
pnpm run infra:up
```

This command runs `minio-init` to automatically create the required S3 storage buckets (`app-storage` and `langfuse`).

### Step 3: Initialize Database Schema

Push the Drizzle ORM database schema to the newly provisioned PostgreSQL instance (`app_db`):

```bash
pnpm run db:push
```

### Step 4: Pull Local Model (Optional for Local Mode)

If you are using the default local SLM mode, pull the configured Ollama model:

```bash
ollama pull gemma4:e4b-it-q4_K_M
```

### Step 5: Start Local Development Servers

Start all three applications (`web`, `server`, `agent`) concurrently with live hot-reloading:

```bash
pnpm dev
```

---

## 5. Service Endpoints and Default Ports

| Service | URL | Description | Default Credentials |
| :--- | :--- | :--- | :--- |
| **Web UI** | `http://localhost:3001` | Main Next.js Chat & Agent interface | - |
| **Backend API** | `http://localhost:3000` | Express REST API & Auth endpoint | - |
| **Agent Server** | `http://localhost:8000` | FastAPI AG-UI & Streaming endpoint | - |
| **Agent Health** | `http://localhost:8000/health` | Agent & checkpointer health status | - |
| **Langfuse Web** | `http://localhost:3002` | LLM Observability & Trace UI | Self-signup on first launch |
| **MinIO Console**| `http://localhost:9001` | Object Storage file management | `minioadmin` / `minioadmin` |
| **PostgreSQL** | `localhost:5432` | Relational database (`app_db`) | `postgres` / `password` |
| **Redis** | `localhost:6379` | Cache, distributed locks, and Pub/Sub | - |

---

## 6. Configuring LLM Observability (Langfuse)

1. Open `http://localhost:3002` in your browser and create an account on first launch.
2. Create an Organization and Project (e.g., `Deep Agent`).
3. Navigate to **Settings -> API Keys** and click **Create new API keys**.
4. Paste the generated keys into `apps/agent/.env`:

```dotenv
LANGFUSE_PUBLIC_KEY=pk-lf-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
LANGFUSE_SECRET_KEY=sk-lf-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
LANGFUSE_HOST=http://localhost:3002
```

5. Restart the development server (`pnpm dev`). Traces, tool executions, latency, and token metrics will be streamed to Langfuse in real time.

---

## 7. Customizing the Agent Configuration

The Python Deep Agent is declaratively configured via `apps/agent/agent.config.yaml`:

```yaml
agent:
  mode: "local_slm"               # Options: "local_slm" | "cloud_provider"
  name: "Deep Agent"              # Display name used in prompts and traces
  debug: true                     # Hot-reloads prompt templates on file modification

models:
  primary: "ollama:gemma4"        # Primary LLM (e.g. openai:gpt-4o, anthropic:claude-3-5-sonnet)
  fallback: null                  # Optional fallback model if primary hits rate limits
  grader: null                    # Optional judge model for rubric self-correction

limits:
  model_calls: 30                 # Max LLM calls per run to prevent runaway loops
  tool_calls: 100                 # Max tool executions per run
  recursion: 100                  # Max LangGraph transition depth

features:
  enable_subagents: true          # Enables general-purpose context-quarantined subagents
  enable_summarization_tool: true # Exposes on-demand conversation compaction
  rubric_enabled: false           # Enables LLM-as-a-judge quality self-critique loop
  max_rubric_iterations: 3        # Max self-correction critique cycles

storage:
  memory_route: "/memories/"      # Virtual filesystem route for cross-thread memory
  sessions_dir: "workspace/sessions"
```

### Switching to Cloud Providers

To switch from Ollama to a cloud provider, update `apps/agent/.env`:

```dotenv
# OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Anthropic
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
LLM_PROVIDER=google
GOOGLE_API_KEY=...
```

Then update `primary` in `apps/agent/agent.config.yaml` to match (e.g., `openai:gpt-4o-mini` or `anthropic:claude-3-5-sonnet-20241022`).

---

## 8. Adapting the Template for Your Project

To brand and adapt this repository for a new application:

1. **Repository & Package Manifests**:
   - Update `"name"` in `package.json` to your project name.
   - Update the GitHub remote URL in your local repository (`git remote set-url origin <new-url>`).

2. **Web Branding**:
   - Change application title and branding text in `apps/web/src/app/layout.tsx` and `apps/web/src/features/sidebar/components/app-sidebar.tsx`.

3. **Agent Identity**:
   - Update `name` in `apps/agent/agent.config.yaml` and system prompts in `apps/agent/prompts/system_prompt.md`.

4. **Infrastructure Namespaces (Optional)**:
   - Change database and volume names in `docker-compose.yml` and `.env` files if running alongside other projects.

---

## 9. Available Scripts

| Command | Description |
| :--- | :--- |
| `pnpm dev` | Starts web, server, and agent concurrently with hot-reloading |
| `pnpm build` | Builds all packages and applications for production |
| `pnpm check-types` | Type-checks all TypeScript packages across the workspace |
| `pnpm test` | Runs the JavaScript/TypeScript Vitest suite |
| `pnpm run infra:up` | Starts all 7 Docker infrastructure services in the background |
| `pnpm run infra:down` | Stops all Docker infrastructure services |
| `pnpm run infra:logs` | Streams logs from all Docker infrastructure services |
| `pnpm run db:push` | Synchronizes Drizzle ORM schema with PostgreSQL |
| `pnpm run db:generate` | Generates SQL migration files from Drizzle schema |
| `pnpm run db:migrate` | Applies pending SQL migrations |
| `pnpm run db:studio` | Launches Drizzle Studio database management interface |
| `pnpm run docker:up` | Builds and runs full containerized production stack |
| `pnpm run docker:down` | Stops full containerized production stack |

---

## 10. Quality Assurance & Verification

Run the full automated test suite to ensure system integrity:

```bash
# TypeScript workspace type validation
pnpm check-types

# Frontend and shared package unit tests (167+ tests)
pnpm test

# Python agent and checkpointer test suite (110+ tests)
cd apps/agent && uv run pytest && cd ../..
```

---

## 11. License

This project is open-source and available under the MIT License.
