# CopilotKit + LangChain Deep Agents + FastAPI 연동 조사

조사일: 2026-08-15

## 결론

이 조합의 공식적인 형태는 다음 3계층이다.

```text
Browser / React
  <CopilotKit runtimeUrl="/api/copilotkit" agent="default">
        |
        | CopilotKit Runtime 요청 (agent/run, info 등)
        v
Next.js / Copilot Runtime
  CopilotRuntime
    -> LangGraphHttpAgent(url="http://.../copilotkit")
        |
        | raw AG-UI RunAgentInput + SSE
        v
Python / FastAPI
  add_langgraph_fastapi_endpoint
    -> LangGraphAGUIAgent
      -> create_deep_agent()가 만든 LangGraph graph
```

여기서 **“Python AG-UI”는 별도 제품이나 별도 에이전트 런타임의 이름이 아니다.** Python의 `ag-ui-langgraph` 어댑터가 FastAPI에 노출하는 **raw AG-UI 프로토콜 엔드포인트**를 짧게 부른 것이다. AG-UI는 프론트엔드와 에이전트가 실행 입력, 메시지, 도구 호출, 상태, 종료 이벤트를 주고받는 프로토콜이다. CopilotKit의 Deep Agents 문서는 이 연결을 “Deep Agents를 AG-UI를 통해 사용자에게 제공한다”고 설명하고, Quickstart는 AG-UI가 상태와 도구 호출을 실시간 스트리밍한다고 명시한다. ([Deep Agents 소개](https://docs.copilotkit.ai/deepagents), [Deep Agents Quickstart](https://docs.copilotkit.ai/deepagents/quickstart))

`create_deep_agent()` 자체는 HTTP 서버가 아니다. Deep Agents는 파일시스템, 컨텍스트 관리, 서브에이전트 등의 기능을 조립하는 agent harness이고, 결과로 실행 가능한 LangGraph graph를 만든다. HTTP/AG-UI 연결은 그 위에 별도로 붙는다. ([LangChain Deep Agents overview](https://docs.langchain.com/oss/python/deepagents/overview), [Deep Agents 공식 아키텍처](https://github.com/langchain-ai/deepagents/blob/main/libs/ARCHITECTURE.md))

따라서 브라우저 요청을 FastAPI에 그대로 전달하는 단순 바이트 프록시는 이 구조와 다르다. React가 `/api/copilotkit`에 보내는 Copilot Runtime 요청 envelope와 FastAPI helper가 받는 raw `RunAgentInput`은 서로 다른 경계의 입력이다. 중간의 `CopilotRuntime + LangGraphHttpAgent`가 discovery/routing과 AG-UI 세션 연결을 맡아야 한다. Copilot Runtime 공식 문서도 Runtime을 프론트엔드와 AI 에이전트를 잇는 백엔드 계층으로 정의한다. ([Copilot Runtime](https://docs.copilotkit.ai/langgraph-fastapi/backend/copilot-runtime))

## 제공된 네 문서에서 확인한 내용

### 1. CopilotKit 블로그

[How to build a Frontend for LangChain Deep Agents with CopilotKit](https://www.copilotkit.ai/blog/how-to-build-a-frontend-for-langchain-deep-agents-with-copilotkit)은 전체 배선을 한 예제 안에서 보여 준다.

- `create_deep_agent(...)`에 `CopilotKitMiddleware()`를 추가한다.
- React에는 `@copilotkit/react-core`, `@copilotkit/react-ui`, 서버에는 `@copilotkit/runtime`을 사용한다.
- React provider는 `runtimeUrl="/api/copilotkit"`와 agent name을 사용한다.
- Next.js route는 `CopilotRuntime`, `ExperimentalEmptyAdapter`, `copilotRuntimeNextJSAppRouterEndpoint`, `LangGraphHttpAgent`를 사용한다.
- FastAPI는 `LangGraphAGUIAgent`로 graph를 감싸고 `add_langgraph_fastapi_endpoint`로 노출한다.

즉 블로그에서 “proxy”라고 부르는 Next route는 단순 `fetch()` 프록시가 아니라 **Copilot Runtime이 들어 있는 프로토콜 브리지**다.

### 2. LangChain Deep Agents overview

[Deep Agents overview](https://docs.langchain.com/oss/python/deepagents/overview)는 Deep Agents의 책임을 설명한다. `create_deep_agent`가 모델, 도구, 프롬프트를 받아 agent를 만들고 `invoke({"messages": ...})`로 실행하는 것이 기본 사용법이다. 파일 기반 컨텍스트 관리, 서브에이전트 위임, 메모리, human-in-the-loop가 핵심 기능이며 CopilotKit이나 HTTP endpoint는 Deep Agents 자체의 책임이 아니다.

이 프로젝트의 `deepagents==0.7.6` 설치 소스에서도 `create_deep_agent(...)`의 반환형은 `CompiledStateGraph`다. 현재 `apps/agent/agent.py`가 이 graph에 `CopilotKitMiddleware()`와 `MemorySaver()`를 넣는 방식은 공식 Quickstart와 일치한다. ([잠금 파일](../../apps/agent/uv.lock), [프로젝트 agent 구성](../../apps/agent/agent.py))

### 3. CopilotKit Deep Agents 문서

[Deep Agents 소개](https://docs.copilotkit.ai/deepagents)와 [Quickstart](https://docs.copilotkit.ai/deepagents/quickstart)는 FastAPI 방식을 별도 탭으로 제공한다. 그 탭의 Python 구성은 다음 조합이다.

```python
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import CopilotKitMiddleware, LangGraphAGUIAgent
from deepagents import create_deep_agent
from fastapi import FastAPI
from langgraph.checkpoint.memory import MemorySaver

app = FastAPI()

graph = create_deep_agent(
    model=model,
    tools=tools,
    middleware=[CopilotKitMiddleware()],
    system_prompt="You are a helpful assistant.",
    checkpointer=MemorySaver(),
)

add_langgraph_fastapi_endpoint(
    app=app,
    agent=LangGraphAGUIAgent(
        name="default",
        description="Deep Agent",
        graph=graph,
    ),
    path="/copilotkit",
)
```

공식 예시는 FastAPI endpoint를 `/`에 두지만, path 자체는 선택할 수 있다. 이 프로젝트에서는 기존 주소를 유지하기 위해 `/copilotkit`으로 통일하면 된다. 중요한 것은 Next의 `LangGraphHttpAgent.url`과 FastAPI의 `path`가 정확히 같아야 한다는 점이다.

### 4. CopilotKit LangGraph FastAPI 문서

[LangGraph FastAPI 소개](https://docs.copilotkit.ai/langgraph-fastapi)는 React frontend, Copilot Runtime, LangGraph agent backend를 서로 다른 계층으로 보여 준다. [FastAPI Quickstart](https://docs.copilotkit.ai/langgraph-fastapi/quickstart)도 Runtime endpoint 경로와 React provider의 `runtimeUrl`이 일치해야 한다고 안내한다.

현재 Copilot Runtime 문서는 `copilotRuntimeNextJSAppRouterEndpoint`를 legacy(v1) endpoint factory라고 분류하고 새 프로젝트에는 v2 handler를 권장한다. 다만 **현재 Deep Agents FastAPI Quickstart 자체가 여전히 이 helper와 `LangGraphHttpAgent` 조합을 명시하며, 1.67.1에도 해당 exports가 존재한다.** 기존 v1 React UI를 최소 변경으로 연결할 때는 아래 배선이 문서 및 설치 버전과 일치한다. v2 frontend/API로의 전면 전환은 별도 마이그레이션 문제다. ([Copilot Runtime의 legacy/v2 설명](https://docs.copilotkit.ai/langgraph-fastapi/backend/copilot-runtime))

## 잠금 버전과 실제 API 대조

| 계층 | 잠금 버전 | 확인된 역할/API |
| --- | --- | --- |
| React | `@copilotkit/react-core@1.67.1`, `@copilotkit/react-ui@1.67.1` | root export의 `CopilotKit`, `CopilotSidebar`; `/v2` export도 별도로 존재 |
| Next Runtime | `@copilotkit/runtime@1.67.1` | `CopilotRuntime`, `ExperimentalEmptyAdapter`, `copilotRuntimeNextJSAppRouterEndpoint`; `@copilotkit/runtime/langgraph`의 `LangGraphHttpAgent` |
| Python CopilotKit | `copilotkit==0.1.94` | `CopilotKitMiddleware`, `LangGraphAGUIAgent(name=..., graph=..., description=...)` |
| Python AG-UI adapter | `ag-ui-langgraph==0.0.42` | `add_langgraph_fastapi_endpoint(app, agent, path)` |
| Deep Agents | `deepagents==0.7.6` | `create_deep_agent(...) -> CompiledStateGraph` |

버전은 [웹 package manifest](../../apps/web/package.json), [pnpm lock](../../pnpm-lock.yaml), [Python project manifest](../../apps/agent/pyproject.toml), [uv lock](../../apps/agent/uv.lock)에서 확인했다. 배포 패키지의 1차 자료도 함께 대조했다. ([`@copilotkit/runtime@1.67.1` npm package](https://www.npmjs.com/package/@copilotkit/runtime/v/1.67.1), [`copilotkit==0.1.94` PyPI](https://pypi.org/project/copilotkit/0.1.94/), [`ag-ui-langgraph==0.0.42` PyPI](https://pypi.org/project/ag-ui-langgraph/0.0.42/), [`deepagents==0.7.6` PyPI](https://pypi.org/project/deepagents/0.7.6/))

특히 설치된 `ag-ui-langgraph==0.0.42`의 helper 구현은 다음 동작을 한다.

1. 지정한 `path`에 FastAPI `POST` route를 등록한다.
2. request body를 Pydantic `RunAgentInput`으로 받는다.
3. 동시 요청의 실행 상태가 섞이지 않도록 agent를 request마다 `clone()`한다.
4. agent event를 `EventEncoder`로 인코딩해 `StreamingResponse`로 반환한다.
5. `${path}/health` GET route도 등록한다.

따라서 별도의 수동 body 분기, 임의 info 응답, 직접 `EventEncoder` loop를 애플리케이션 코드에 다시 구현할 필요가 없다. 이 세부 동작은 현재 virtualenv의 `ag_ui_langgraph/endpoint.py`와 패키지 설명에서 확인했다. ([`ag-ui-langgraph==0.0.42` 설명과 usage](https://pypi.org/project/ag-ui-langgraph/0.0.42/))

`@copilotkit/runtime@1.67.1`의 배포 선언도 아래 imports를 실제로 export하고, 그 버전은 `@ag-ui/langgraph@0.0.42`를 정확히 의존한다. `LangGraphHttpAgent`가 상속하는 HTTP agent의 필수 설정은 `url: string`이며 `headers`와 custom `fetch`는 선택 사항이다.

## 프로젝트에 맞는 정확한 wiring

### Python: raw AG-UI endpoint

```python
from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import LangGraphAGUIAgent

agent_graph = build_agent()

add_langgraph_fastapi_endpoint(
    app=app,
    agent=LangGraphAGUIAgent(
        name="default",
        description="Deep Agent (LangChain deepagents)",
        graph=agent_graph,
    ),
    path="/copilotkit",
)
```

경계의 책임은 다음과 같다.

- `CopilotKitMiddleware`: frontend tools/context를 Deep Agent 실행에 연결한다.
- `LangGraphAGUIAgent`: LangGraph event/state를 AG-UI event로 변환한다.
- `add_langgraph_fastapi_endpoint`: raw `RunAgentInput` POST와 SSE response를 FastAPI에 연결한다.
- `create_deep_agent`: 실제 agent graph를 만든다.

### Next.js: Copilot Runtime endpoint

현재 1.67.1과 Deep Agents FastAPI Quickstart에 맞는 imports/API는 다음과 같다.

```typescript
import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";

const agentServerUrl = process.env.AGENT_SERVER_URL ?? "http://127.0.0.1:8000";

const runtime = new CopilotRuntime({
  agents: {
    default: new LangGraphHttpAgent({
      url: `${agentServerUrl}/copilotkit`,
    }),
  },
});

const serviceAdapter = new ExperimentalEmptyAdapter();

export async function POST(req: NextRequest) {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
}
```

`ExperimentalEmptyAdapter`를 쓰는 이유는 LLM 호출과 orchestration을 Python Deep Agent가 수행하기 때문이다. `LangGraphHttpAgent`는 Runtime이 연결할 remote raw AG-UI endpoint를 나타낸다. `copilotRuntimeNextJSAppRouterEndpoint`는 브라우저가 사용하는 Copilot Runtime HTTP API를 Next App Router route로 제공한다. ([CopilotKit 블로그의 Next route](https://www.copilotkit.ai/blog/how-to-build-a-frontend-for-langchain-deep-agents-with-copilotkit), [Deep Agents FastAPI Quickstart](https://docs.copilotkit.ai/deepagents/quickstart))

`@copilotkit/runtime`은 `react-core`나 `react-ui`에 포함된 것으로 간주하면 안 된다. 서버 route가 이를 직접 import하므로 웹 앱의 직접 dependency로 같은 버전 `1.67.1`을 두는 것이 맞다.

### React provider

기존 v1 UI를 유지하는 최소 구성은 공식 블로그와 같다.

```tsx
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

<CopilotKit runtimeUrl="/api/copilotkit" agent="default">
  <CopilotSidebar>{children}</CopilotSidebar>
</CopilotKit>
```

여기서 두 값이 서로 다른 계층을 가리킨다.

- `runtimeUrl="/api/copilotkit"`: 브라우저가 호출할 **Next.js Copilot Runtime** 주소
- `agent="default"`: Next Runtime의 `agents.default`와 Python `LangGraphAGUIAgent(name="default")`에 공통으로 쓸 agent id

현재 Deep Agents Quickstart의 최신 UI 예제는 `@copilotkit/react-core/v2`에서 `CopilotKit`과 `CopilotSidebar`를 가져온다. 1.67.1에는 `/v2` export가 실제 존재하지만, 이것은 UI API 마이그레이션 선택지다. 지금의 protocol mismatch를 고치는 필수 조건은 Next Runtime 계층을 넣는 것이며, root v1 provider와 `@copilotkit/react-ui`를 함께 유지해도 블로그의 공식 패턴과 일치한다. v2로 옮길 때는 provider, sidebar, hooks, styles를 한 묶음으로 검토해야 한다.

## Docker 네트워킹

로컬 프로세스와 Compose 컨테이너는 서로 다른 주소를 사용해야 한다.

| 호출 주체 | 대상 | 올바른 주소 |
| --- | --- | --- |
| 브라우저 | Next Runtime | `/api/copilotkit` |
| host에서 실행한 Next dev server | host에서 실행한 Python | `http://127.0.0.1:8000/copilotkit` |
| Compose의 `web` 컨테이너 | Compose의 `agent` 컨테이너 | `http://agent:8000/copilotkit` |
| `agent` 컨테이너 자체 healthcheck | 자기 FastAPI | `http://localhost:8000/copilotkit/health` |

Docker Compose는 같은 project network의 서비스를 service name으로 DNS 등록하고, service-to-service 통신에는 host port가 아닌 container port를 사용한다. 따라서 `web` 컨테이너 안의 `localhost:8000`은 Python agent가 아니라 web 컨테이너 자신을 뜻한다. ([Docker Compose networking](https://docs.docker.com/compose/how-tos/networking/))

필요한 Compose 설정은 다음 형태다.

```yaml
services:
  web:
    environment:
      AGENT_SERVER_URL: http://agent:8000
    depends_on:
      agent:
        condition: service_healthy

  agent:
    healthcheck:
      test:
        - CMD
        - python
        - -c
        - >-
          import urllib.request;
          urllib.request.urlopen('http://localhost:8000/copilotkit/health')
```

`AGENT_SERVER_URL`은 Next 서버만 읽는 server-side 환경변수여야 한다. 브라우저에 노출할 `NEXT_PUBLIC_` 변수가 아니다. 브라우저는 계속 same-origin `/api/copilotkit`만 호출한다.

## 경로와 프로토콜 체크리스트

| 경계 | 기대 입력/출력 | 이 프로젝트의 경로 |
| --- | --- | --- |
| React → Next Runtime | Copilot Runtime HTTP 요청 | `/api/copilotkit` |
| Next Runtime → Python | raw AG-UI `RunAgentInput` POST | `${AGENT_SERVER_URL}/copilotkit` |
| Python → Next Runtime | AG-UI SSE events | 같은 response stream |
| Python helper health | JSON health response | `/copilotkit/health` |

확인할 불변조건은 다음과 같다.

1. React의 `agent`와 Runtime `agents`의 key가 모두 `default`다.
2. `LangGraphHttpAgent.url`은 실제 FastAPI helper의 `path`까지 포함한다.
3. `/api/copilotkit`은 raw fetch proxy가 아니라 `CopilotRuntime` handler다.
4. FastAPI endpoint는 Runtime envelope가 아니라 raw `RunAgentInput`만 받는다.
5. Compose 안에서는 agent service name과 container port인 `agent:8000`을 사용한다.
6. 모든 `@copilotkit/*` JavaScript 패키지는 `1.67.1`로 맞춘다.

이 wiring이면 각 계층이 공식적으로 기대하는 프로토콜을 받고, 단순 프록시에서 발생했던 “HTTP 200이지만 agent 실행/SSE가 없음” 문제를 제거할 수 있다.
