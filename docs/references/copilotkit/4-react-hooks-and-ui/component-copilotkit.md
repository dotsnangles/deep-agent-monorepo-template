---
title: "CopilotKit"
description: "The CopilotKit provider component, wrapping your application."
---

{
 /*
  * ATTENTION! DO NOT MODIFY THIS FILE!
  * This page is auto-generated. If you want to make any changes to this page, changes must be made at:
  * packages/react-core/src/components/copilot-provider/copilotkit.tsx
  */
}
This component will typically wrap your entire application (or a sub-tree of your application where you want to have a copilot). It provides the copilot context to all other components and hooks.
 
## Example
 
You can find more information about self-hosting CopilotKit [here](/guides/self-hosting).
 
```tsx
 
">
  // ... your app ...

```

## Properties

 
Your Copilot Cloud API key.
 
  Don't have it yet? Go to https://dashboard.operations.copilotkit.ai and get one for free.

 
Your public license key for accessing Enterprise Intelligence Platform features.
 
  Don't have it yet? Go to https://dashboard.operations.copilotkit.ai and get one for free.

 
Restrict input to specific topics using guardrails.
  @remarks
 
  This feature is only available when using CopilotKit's hosted cloud service. To use this feature, sign up at https://dashboard.operations.copilotkit.ai to get your publicApiKey. The feature allows restricting chat conversations to specific topics.

 
The endpoint for the Copilot Runtime instance. [Click here for more information](/backend/copilot-runtime).

 
The endpoint for the Copilot transcribe audio service.

 
The endpoint for the Copilot text to speech service.

 | (() => Record<string, string>)"  > 
Additional headers to be sent with the request.
  Can be a static object or a function that returns headers dynamically
  (useful for refreshing auth tokens).
 
  For example:
  ```tsx
  // Static headers
  headers={{ "Authorization": "Bearer X" }}
 
  // Dynamic headers (re-evaluated on each render)
  headers={() => ({ "Authorization": `Bearer ${getToken()}` })}
  ```

 
The children to be rendered within the CopilotKit.

"  > 
Custom properties to be sent with the request.
  Can include threadMetadata for thread creation and authorization for LangGraph Platform authentication.
  For example:
  ```js
  {
    'user_id': 'users_id',
    'authorization': 'your-auth-token', // For LangGraph Platform authentication
    threadMetadata: {
      'account_id': '123',
      'user_type': 'premium'
    }
  }
  ```
 
  Note: The `authorization` property is automatically forwarded to LangGraph agents. See the [LangGraph Agent Authentication Guide](/coagents/shared/guides/langgraph-platform-authentication) for details.

 
Indicates whether the user agent should send or receive cookies from the other domain
  in the case of cross-origin requests.
 
  To enable HTTP-only cookie authentication, set `credentials="include"` and configure
  CORS on your runtime endpoint:
 
  ```tsx
  // Frontend (https://myapp.com)
  
    {children}
  
 
  // Backend (https://api.myapp.com)
  copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    endpoint: "/copilotkit",
    cors: {
      origin: "https://myapp.com",
      credentials: true,
    },
  });
  ```

 
The name of the agent to use.

"  > 
The forwarded parameters to use for the task.

 void; }>; }"  > 
The auth config to use for the CopilotKit.
  @remarks
 
  This feature is only available when using CopilotKit's hosted cloud service. To use this feature, sign up at https://dashboard.operations.copilotkit.ai to get your publicApiKey. The feature allows restricting chat conversations to specific topics.

 
The thread id to use for the CopilotKit.

 
Optional error handler for comprehensive debugging and observability.
 
  Requires publicApiKey: Error handling only works when publicApiKey is provided.
  This is an Enterprise Intelligence Platform feature.
 
  @param errorEvent - Structured error event with rich debugging context
 
  @example
  ```typescript
   {
      debugDashboard.capture(errorEvent);
    }}
  >
  ```

 
Enable or disable the CopilotKit Inspector, letting you inspect AG-UI events,
  view agent messages, check agent state, and visualize agent context. Defaults
  to enabled.

 
Enable debug logging. On the server (`CopilotRuntime`), this enables
  structured Pino logging of the AG-UI event pipeline. On the client,
  this configuration is forwarded to the AG-UI transport layer
  (`transformChunks`) for transport-level debug output.
 
  Pass `true` for full output, or an object for granular control:
 
  ```tsx
  
    {children}
  
  ```
