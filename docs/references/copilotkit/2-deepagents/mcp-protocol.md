---
title: "MCP"
description: "Integrate Model Context Protocol (MCP) servers into your React applications"
---

## Introduction

The Model Context Protocol is an open standard that enables developers to build secure, two-way connections between their data sources and AI-powered tools. With MCP, you can:

- Connect AI applications to your data sources
- Enable AI tools to access and utilize your data securely
- Build AI-powered features that have context about your application

For further reading, check out the [Model Context Protocol](https://modelcontextprotocol.io/introduction) website.

> [!NOTE]
> If you want MCP servers to return **interactive UI components** that render
>   directly in the chat, check out [MCP
>   Apps](/generative-ui/mcp-apps).

<div className="text-center text-sm text-muted-foreground mt-2 mb-8 w-3/5 mx-auto">
  MCP is one of three prominent [agentic protocols](/agentic-protocols)
  CopilotKit supports to connect agents to user-facing frontends
</div>

## Quickstart with CopilotKit

  
    ### Get an MCP Server
    First, we need to make sure we have an MCP server to connect to. You can use any MCP SSE endpoint you have configured.

    
      
        Composio provides a registry of ready-to-use MCP servers with simple authentication and setup.

        To get started, go to [Composio](https://mcp.composio.dev/), find a server that suits your needs and copy the SSE URL before continuing here.
      
    

  
  
            <p className="text-xl font-semibold">Use the CopilotKit CLI</p>
        </div>
    }
  >
    }
    >
      
        ### Run the CLI
        Just run this following command in your Next.js application to get started!

        
            
                No problem! Just use `create-next-app` to make one quickly.
                ```bash
                npx create-next-app@latest
                ```
            
        

        ```bash
        npx copilotkit@latest init -m MCP
        ```
      
    
    }
    >
      
        #### Set up the CopilotKit Provider

        Wrap your application with the `CopilotKit` provider:

        ```tsx
        "use client";

        
        default function App() {
          return (
            ">
              {/* Your app content */}
            
          );
        }
        ```
      
      
        #### Connect to MCP Servers

        Create a component to manage MCP server connections:

        ```tsx
        "use client";

                
        function McpServerManager() {
          const { setMcpServers } = useCopilotKit();

          useEffect(() => {
            setMcpServers([
              {
                // Try a sample MCP server at https://mcp.composio.dev/
                endpoint: "your_mcp_sse_url",
              },
            ]);
          }, [setMcpServers]);

          return null;
        }

        default McpServerManager;

        ```
      
      
        #### Add the Chat Interface

        Add the `CopilotChat` component to your page:

        ```tsx
        "use client";

        
        default function ChatInterface() {
          return (
            <div className="flex h-screen p-4">
              
              
            </div>
          );
        }
        ```
      
      
        #### Visualize MCP Tool Calls (Optional)

        Create a component to display MCP tool calls in your UI:

        ```tsx
        "use client";

        import {
          useFrontendTool,
          CatchAllActionRenderProps,
        } from "@copilotkit/react-core/v2";

        function ToolRenderer() {
          useFrontendTool({
            /**
             * The asterisk (*) matches all tool calls
             */
            name: "*",
            render: ({ name, status, args, result }: CatchAllActionRenderProps<[]>) => (
              
            ),
          });
          return null;
        }
        ```
      
      
        #### Complete Implementation

        Combine all components together:

        ```tsx
        "use client";

        
        default function Page() {
          return (
            ">
              <div className="flex h-screen p-4">
                
                
                
              </div>
            
          );
        }
        ```
      
    

  

## Advanced Usage

### Implementing the McpToolCall Component

<details>
<summary>Click to see the McpToolCall component implementation</summary>

```tsx
"use client";

interface ToolCallProps {
  status: "complete" | "inProgress" | "executing";
  name?: string;
  args?: any;
  result?: any;
}

default function MCPToolCall({
  status,
  name = "",
  args,
  result,
}: ToolCallProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Format content for display
  const format = (content: any): string => {
    if (!content) return "";
    const text =
      typeof content === "object"
        ? JSON.stringify(content, null, 2)
        : String(content);
    return text
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  };

  return (
    <div className="bg-[#1e2738] rounded-lg overflow-hidden w-full">
      <div
        className="p-3 flex items-center cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-white text-sm overflow-hidden text-ellipsis">
          {name || "MCP Tool Call"}
        </span>
        <div className="ml-auto">
          <div
            className={`w-2 h-2 rounded-full ${
              status === "complete"
                ? "bg-gray-300"
                : status === "inProgress" || status === "executing"
                  ? "bg-gray-500 animate-pulse"
                  : "bg-gray-700"
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 text-gray-300 font-mono text-xs">
          {args && (
            <div className="mb-4">
              <div className="text-gray-400 mb-2">Parameters:</div>
              <pre className="whitespace-pre-wrap max-h-[200px] overflow-auto">
                {format(args)}
              </pre>
            </div>
          )}

          {status === "complete" && result && (
            <div>
              <div className="text-gray-400 mb-2">Result:</div>
              <pre className="whitespace-pre-wrap max-h-[200px] overflow-auto">
                {format(result)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

</details>

### Self-Hosting Option

<details>
<summary>Click here to learn how to use MCP with self-hosted runtime</summary>

> [!NOTE]
> The Copilot Runtime handles communication with LLMs, message history, and
>   state. You can self-host it or use{" "}
>   Copilot Cloud{" "}
>   (recommended). Learn more in our [Self-Hosting
>   Guide](/backend/copilot-runtime).

To configure your self-hosted runtime with MCP servers, you'll need to implement the `createMCPClient` function that matches this interface:

```typescript
type CreateMCPClientFunction = (
  config: MCPEndpointConfig,
) => Promise;
```

For detailed implementation guidance, refer to the [official MCP SDK documentation](https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#writing-mcp-clients).

Here's a basic example of configuring the runtime:

```tsx
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";

const serviceAdapter = new OpenAIAdapter();

const runtime = new CopilotRuntime({
  createMCPClient: async (config) => {
    // Implement your MCP client creation logic here
    // See the MCP SDK docs for implementation details
  },
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

</details>
