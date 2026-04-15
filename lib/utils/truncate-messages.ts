import type Anthropic from "@anthropic-ai/sdk";

type ApiMessage = Anthropic.MessageParam;

const MAX_MESSAGES = 40;

/**
 * Truncate the conversation to stay within token budget.
 * Keeps the most recent messages while ensuring we don't split
 * tool_use / tool_result pairs (which would break the API contract).
 */
export function truncateMessages(
  messages: ApiMessage[],
  maxMessages = MAX_MESSAGES
): ApiMessage[] {
  if (messages.length <= maxMessages) return messages;

  const start = messages.length - maxMessages;
  let safeStart = start;

  for (let i = start; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "user") {
      const content = msg.content;
      if (typeof content === "string") {
        safeStart = i;
        break;
      }
      if (Array.isArray(content) && content.length > 0) {
        const first = content[0];
        if (typeof first === "object" && "type" in first && first.type === "tool_result") {
          continue;
        }
        safeStart = i;
        break;
      }
    }
  }

  return messages.slice(safeStart);
}
