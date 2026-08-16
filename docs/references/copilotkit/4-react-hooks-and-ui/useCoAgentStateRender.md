---
title: "useCoAgentStateRender"
description: "The useCoAgentStateRender hook allows you to render the state of the agent in the chat."
---

{
 /*
  * ATTENTION! DO NOT MODIFY THIS FILE!
  * This page is auto-generated. If you want to make any changes to this page, changes must be made at:
  * packages/react-core/src/hooks/use-coagent-state-render.ts
  */
}
The useCoAgentStateRender hook allows you to render UI or text based components on a Agentic Copilot's state in the chat.
This is particularly useful for showing intermediate state or progress during Agentic Copilot operations.
 
## Usage
 
### Simple Usage
 
```tsx
 
type YourAgentState = {
  agent_state_property: string;
}
 
useCoAgentStateRender({
  name: "basic_agent",
  nodeName: "optionally_specify_a_specific_node",
  render: ({ status, state, nodeName }) => {
    return (
      
    );
  },
});
```
 
This allows for you to render UI components or text based on what is happening within the agent.
 
### Example
A great example of this is in our Perplexity Clone where we render the progress of an agent's internet search as it is happening.
You can play around with it below or learn how to build it with its [demo](/coagents/videos/perplexity-clone).
 

> [!NOTE]
> This example is hosted on Vercel and may take a few seconds to load.

 
<iframe src="https://examples-coagents-ai-researcher-ui.vercel.app/" className="w-full rounded-lg border h-[700px] my-4" />

## Parameters

 
The name of the coagent.

 
The node name of the coagent.

, ) => void | Promise<void>"  > 
The handler function to handle the state of the agent.

, ) => string | React.ReactElement | undefined | null) | string"  > 
The render function to handle the state of the agent.
