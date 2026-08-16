---
title: "useCopilotChat"
---

{
 /*
  * ATTENTION! DO NOT MODIFY THIS FILE!
  * This page is auto-generated. If you want to make any changes to this page, changes must be made at:
  * packages/react-core/src/hooks/use-copilot-chat.ts
  */
}
`useCopilotChat` is a lightweight React hook for headless chat interactions.
Perfect for controlling the prebuilt chat components programmatically.
 
Open Source Friendly - Works without requiring a free public license key.
 

> [!NOTE]
> Get started with [useCopilotChatHeadless_c](https://docs.copilotkit.ai/reference/v1/hooks/useCopilotChatHeadless_c).

 
## Use Cases
 
- Programmatic Messaging: Send messages without displaying chat UI
- Programmatic control: Control prebuilt component programmatically
- Background Operations: Trigger AI interactions in the background
- Fire-and-Forget: Send messages without needing to read responses
 
## Usage
 
```tsx
 
const { appendMessage } = useCopilotChat();
 
// Example usage without naming conflicts
const handleSendMessage = async (content: string) => {
  await appendMessage(
    new TextMessage({
      role: MessageRole.User,
      content,
    })
  );
};
```
 
## Return Values
The following properties are returned from the hook:
 

Array of messages in old non-AG-UI format, use for compatibility only

 
 Promise<void>" deprecated>
Append message using old format, use `sendMessage` instead

 
 Promise<void>">
Regenerate the response for a specific message by ID

 
 void">
Stop the current message generation process

 
 void">
Clear all messages and reset chat state completely

 

Whether the chat is currently generating a response

 
 Promise">
Manually trigger chat completion for advanced usage

 

Array of Model Context Protocol server configurations

 
 void">
Update MCP server configurations for enhanced context

## Parameters

 
A unique identifier for the chat. If not provided, a random one will be
  generated. When provided, the `useChat` hook with the same `id` will
  have shared states across components.

 | Headers"  > 
HTTP headers to be sent with the API request.

 
Initial messages to populate the chat with.

 
A function to generate the system message. Defaults to `defaultSystemMessage`.

 
Disables inclusion of CopilotKit’s default system message. When true, no system message is sent (this also suppresses any custom message from <code>makeSystemMessage</code>).

 
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

 Promise<void> | void"  >
