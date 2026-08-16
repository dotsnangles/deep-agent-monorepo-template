---
title: Deep Agents
description: Leverage LangGraph Deep Agents to build sophisticated agentic applications.
---

## Prerequisites

Before you begin, you'll need the following:

- An OpenAI API key
- Node.js 20+
- Your favorite package manager
- A LangSmith API key - only required if deploying to LangSmith Platform

## Getting started

    
        ### Initialize your agent project

        If you don't already have a Python project set up, create one using `uv`:

        ```bash
        uv init my-agent
        cd my-agent
        ```
    
    
        ### Add necessary dependencies

        For this agent, we'll just need the `deepagents`, `langchain-openai`, and `copilotkit` packages:

        ```bash
        uv add deepagents copilotkit langchain-openai
        ```
    
    
        If you already have a LangGraph agent written, just reference the following code. In this step
        we create a simple LangGraph agent for the sake of demonstration.

        
            
                First, we'll create a simple LangGraph agent:

                ```python title="main.py"
                from deepagents import create_deep_agent
                from copilotkit import CopilotKitMiddleware
                from langgraph.checkpoint.memory import MemorySaver

                def get_weather(location: str):
                    """Get weather for a location"""
                    return f"The weather in {location} is sunny."

                agent = create_deep_agent(
                    model="openai:gpt-5.4",
                    tools=[get_weather],
                    middleware=[CopilotKitMiddleware()], # for frontend tools and context
                    system_prompt="You are a helpful research assistant.",
                )

                graph = agent
                ```

                Then to test and deploy with LangSmith, we'll also need a `langgraph.json`

                ```sh
                touch langgraph.json
                ```

                ```json title="langgraph.json"
                {
                    "python_version": "3.12",
                    "dockerfile_lines": [],
                    "dependencies": ["."],
                    "package_manager": "uv",
                    "graphs": {
                        "sample_agent": "./main.py:agent"
                    },
                    "env": ".env"
                }
                ```
            
            
                First, add the `ag-ui-langgraph`, `fastapi`, and `uvicorn` packages to your project:

                ```bash
                uv add ag-ui-langgraph fastapi uvicorn
                ```

                Then create a simple LangGraph agent, add a FastAPI app, and build attach our agent as an AG-UI endpoint.

                ```python title="main.py"
                import os
                from fastapi import FastAPI 
                import uvicorn

                # [!code highlight:2]
                from ag_ui_langgraph import add_langgraph_fastapi_endpoint
                from copilotkit import CopilotKitMiddleware, CopilotKitState, LangGraphAGUIAgent
                from deepagents import create_deep_agent
                from langgraph.checkpoint.memory import MemorySaver

                def get_weather(location: str):
                    """Get weather for a location"""
                    return f"The weather in {location} is sunny."

                agent = create_deep_agent(
                    model="openai:gpt-5.4",
                    tools=[get_weather],
                    middleware=[CopilotKitMiddleware()], # for frontend tools and context
                    system_prompt="You are a helpful research assistant.",
                    checkpointer=MemorySaver()
                )

                app = FastAPI()

                # [!code highlight:9]
                add_langgraph_fastapi_endpoint(
                    app=app,
                    agent=LangGraphAGUIAgent(
                        name="sample_agent",
                        description="An example agent to use as a starting point for your own agent.",
                        graph=agent,
                    ),
                    path="/",
                )

                def main():
                    """Run the uvicorn server."""
                    uvicorn.run(
                        "main:app",
                        host="0.0.0.0",
                        port=8123,
                        reload=True,
                    )

                if __name__ == "__main__":
                    main()
                ```
            
        

        
> [!NOTE]
> AG-UI is an open protocol for frontend-agent communication.

    
    
        ### Configure your environment

        Create a `.env` file in your agent directory and add your OpenAI API key:

        ```plaintext title=".env"
        OPENAI_API_KEY=your_openai_api_key
        ```

        
> [!NOTE]
> The starter template is configured to use OpenAI's GPT-4o by default, but you can modify it to use any language model supported by LangGraph.

    
    
        ### Create your frontend

        CopilotKit works with any React-based frontend. We'll use Next.js for this example.

        ```bash
        npx create-next-app@latest frontend
        cd frontend
        ```
    
    
        ### Install CopilotKit packages

        ```npm
        npm install @copilotkit/react-core @copilotkit/runtime
        ```
    
    
        ### Setup Copilot Runtime

        Create an API route to connect CopilotKit to your LangGraph agent:

        ```sh
        mkdir -p app/api/copilotkit && touch app/api/copilotkit/route.ts
        ```

        
            
                ```tsx title="app/api/copilotkit/route.ts"
                import {
                    CopilotRuntime,
                    ExperimentalEmptyAdapter,
                    copilotRuntimeNextJSAppRouterEndpoint,
                } from "@copilotkit/runtime";
                // [!code highlight]
                                
                const serviceAdapter = new ExperimentalEmptyAdapter();

                const runtime = new CopilotRuntime({
                    agents: {
                        // [!code highlight:5]
                        sample_agent: new LangGraphAgent({
                            deploymentUrl:  process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
                            graphId: "sample_agent",
                            langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
                        }),
                    }
                });

                const POST = async (req: NextRequest) => {
                    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
                        runtime,
                        serviceAdapter,
                        endpoint: "/api/copilotkit",
                    });

                    return handleRequest(req);
                };
                ```
            
            
                ```tsx title="app/api/copilotkit/route.ts"
                import {
                    CopilotRuntime,
                    ExperimentalEmptyAdapter,
                    copilotRuntimeNextJSAppRouterEndpoint,
                } from "@copilotkit/runtime";
                // [!code highlight]
                                
                const serviceAdapter = new ExperimentalEmptyAdapter();

                const runtime = new CopilotRuntime({
                    agents: {
                        // [!code highlight:3]
                        sample_agent: new LangGraphHttpAgent({
                            url:  process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
                        }),
                    }
                });

                const POST = async (req: NextRequest) => {
                    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
                        runtime,
                        serviceAdapter,
                        endpoint: "/api/copilotkit",
                    });

                    return handleRequest(req);
                };
                ```
            
        
    
    
        ### Configure CopilotKit Provider

        Wrap your application with the CopilotKit provider:

        ```tsx title="app/layout.tsx"
        // [!code highlight:2]
                import "@copilotkit/react-core/v2/styles.css";

        // ...

        default function RootLayout({ children }: {children: React.ReactNode}) {
            return (
                <html lang="en">
                    <body>
                        {/* [!code highlight:3] */}
                        
                            {children}
                        
                    </body>
                </html>
            );
        }
        ```
    
    
    ### Add the chat interface

    Add the CopilotSidebar component to your page:

    ```tsx title="app/page.tsx"
    "use client";

        
    default function Page() {
        useDefaultRenderTool({
        render: ({name, status, args, result}) => (
            <details>
                <summary>
                    {status === "complete"? `Called ${name}` : `Calling ${name}`}
                </summary>

                <p>Status: {status}</p>
                <p>Args: {JSON.stringify(args)}</p>
                <p>Result: {JSON.stringify(result)}</p>
            </details>
        )})

        return (
            <main>
                <h1>Your App</h1>
                
            </main>
        );
    }
    ```
    
    
        ### Start your agent
        From your agent directory, start the agent server:

        
        
            ```bash
            cd ..
            npx @langchain/langgraph-cli dev --port 8123 --no-browser
            ```
        
        
            ```bash
            cd ..
            uv run main.py
            ```
        
        

        Your agent will be available at `http://localhost:8123`.
    
    
        ### Start your UI

        In a separate terminal, navigate to your frontend directory and start the development server:

        
            
                ```bash
                cd frontend
                npm run dev
                ```
            
            
                ```bash
                cd frontend
                pnpm dev
                ```
            
            
                ```bash
                cd frontend
                yarn dev
                ```
            
            
                ```bash
                cd frontend
                bun dev
                ```
