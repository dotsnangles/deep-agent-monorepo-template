---
title: "CopilotSidebar"
description: "The CopilotSidebar component, providing a sidebar interface for interacting with your copilot."
---

{
 /*
  * ATTENTION! DO NOT MODIFY THIS FILE!
  * This page is auto-generated. If you want to make any changes to this page, changes must be made at:
  * packages/react-ui/src/components/chat/Sidebar.tsx
  */
}
<br/>
<img src="https://cdn.copilotkit.ai/docs/copilotkit/images/CopilotSidebar.gif" width="500" />
 
A chatbot sidebar component for the CopilotKit framework. Highly customizable through various props and custom CSS.
 
See [CopilotPopup](/reference/v1/components/chat/CopilotPopup) for a popup version of this component.
 
## Install Dependencies
 
This component is part of the [@copilotkit/react-ui](https://npmjs.com/package/@copilotkit/react-ui) package.
 
```shell npm2yarn \"@copilotkit/react-ui"\
npm install @copilotkit/react-core @copilotkit/react-ui
```
 
## Usage
 
```tsx
import "@copilotkit/react-ui/styles.css";
 

  

```
 
### With Observability Hooks
 
To monitor user interactions, provide the `observabilityHooks` prop.
Note: This requires a `publicApiKey` in the `` provider.
 
```tsx

   {
        console.log("Sidebar opened");
      },
      onChatMinimized: () => {
        console.log("Sidebar closed");
      },
    }}
  >
    
  

```
 
### Look & Feel
 
By default, CopilotKit components do not have any styles. You can import CopilotKit's stylesheet at the root of your project:
```tsx title="YourRootComponent.tsx"
...
import "@copilotkit/react-ui/styles.css"; // [!code highlight]
 
function YourRootComponent() {
  return (
    
      ...
    
  );
}
```
For more information about how to customize the styles, check out the [Customize Look & Feel](/guides/custom-look-and-feel/customize-built-in-ui-components) guide.

## Properties

 
Custom instructions to be added to the system message. Use this property to
  provide additional context or guidance to the language model, influencing
  its responses. These instructions can include specific directions,
  preferences, or criteria that the model should consider when generating
  its output, thereby tailoring the conversation more precisely to the
  user's needs or the application's requirements.

 
Controls the behavior of suggestions in the chat interface.
 
  `auto` (default) - Suggestions are generated automatically:
    - When the chat is first opened (empty state)
    - After each message exchange completes
    - Uses configuration from `useCopilotChatSuggestions` hooks
 
  `manual` - Suggestions are controlled programmatically:
    - Use `setSuggestions()` to set custom suggestions
    - Use `generateSuggestions()` to trigger AI generation
    - Access via `useCopilotChat` hook
 
  `SuggestionItem[]` - Static suggestions array:
    - Always shows the same suggestions
    - No AI generation involved

 void"  > 
A callback that gets called when the in progress state changes.

 void | Promise<void>"  > 
A callback that gets called when a new message it submitted.

 
A custom stop generation function.

 
A custom reload messages function.

 void"  > 
A callback function to regenerate the assistant's response

 void"  > 
A callback function when the message is copied

 void"  > 
A callback function for thumbs up feedback

 void"  > 
A callback function for thumbs down feedback

 
A list of markdown components to render in assistant message.
  Useful when you want to render custom elements in the message (e.g a reference tag element)

 
Icons can be used to set custom icons for the chat window.

 
Labels can be used to set custom labels for the chat window.

 
Configuration for file attachments in the chat input.
  Enables users to attach images, audio, video, and documents.
 
  @example
  ```tsx
   {
        const url = await uploadToS3(file);
        return { url, mimeType: file.type };
      },
    }}
  />
  ```

 
A function that takes in context string and instructions and returns
  the system message to include in the chat request.
  Use this to completely override the system message, when providing
  instructions is not enough.

 
Disables inclusion of CopilotKit’s default system message. When true, no system message is sent (this also suppresses any custom message from <code>makeSystemMessage</code>).

"  > 
A custom assistant message component to use instead of the default.

"  > 
A custom user message component to use instead of the default.

"  > 
A custom error message component to use instead of the default.

"  > 
A custom Messages component to use instead of the default.

"  > 
A custom RenderMessage component to use instead of the default.
 
  Warning: This is a break-glass solution to allow for custom
  rendering of messages. You are most likely looking to swap out
  the AssistantMessage and UserMessage components instead which
  are also props.

"  > 
A custom suggestions list component to use instead of the default.

"  > 
A custom Input component to use instead of the default.

 
A class name to apply to the root element.

 
Children to render.

 

 
Event hooks for CopilotKit chat events.
  These hooks only work when publicApiKey is provided.

 void; onRetry?: () => void; }) => React.ReactNode"  > 
Custom error renderer for chat-specific errors.
  When provided, errors will be displayed inline within the chat interface.

 
Optional handler for comprehensive debugging and observability.

 
Whether the chat window should be open by default.

 
If the chat window should close when the user clicks outside of it.

 
If the chat window should close when the user hits the Escape key.

 
The shortcut key to open the chat window.
  Uses Command-[shortcut] on a Mac and Ctrl-[shortcut] on Windows.

 void"  > 
A callback that gets called when the chat window opens or closes.

"  > 
A custom Window component to use instead of the default.

"  > 
A custom Button component to use instead of the default.

"  > 
A custom Header component to use instead of the default.

 
Make the sidebar's content wrapper exactly one viewport tall, so children
  can use `height: 100%` (or `flex: 1`) to fill the screen.
 
  Off by default: the wrappers are auto-height, so page content flows
  normally and percentage heights on children collapse to content height.
 
  ```tsx
  
    <div style={{ height: "100%" }}>...</div>
  
  ```
