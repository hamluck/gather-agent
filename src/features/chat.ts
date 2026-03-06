import { sendMessage, sendWithToolResults, Message } from "../claude/client";
import { PLANNER_SYSTEM_PROMPT } from "../claude/prompts";
import { TOOL_DEFINITIONS, handleToolUse } from "../claude/tools";
import * as conversation from "../claude/conversation";
import { concurrencyLimiter, recordApiUsage } from "../api/middleware";
import { UserRequestQueue } from "../utils/throttle";
import { logger } from "../utils/logger";

const MAX_TOOL_ITERATIONS = 3;
const userQueue = new UserRequestQueue();

export async function processChat(
  sessionId: string,
  nickname: string,
  message: string
): Promise<string> {
  return userQueue.enqueue(sessionId, async () => {
    conversation.addUserMessage(sessionId, nickname, message);
    const history = conversation.getHistory(sessionId);

    await concurrencyLimiter.acquire();
    try {
      recordApiUsage(sessionId);
      const result = await sendMessage(
        PLANNER_SYSTEM_PROMPT,
        history,
        sessionId,
        TOOL_DEFINITIONS
      );

      if (result.toolUses.length > 0) {
        return await handleToolLoop(sessionId, nickname, history, result);
      }

      const reply = result.text || "응답을 생성하지 못했습니다.";
      conversation.addAssistantMessage(sessionId, reply);
      return reply;
    } finally {
      concurrencyLimiter.release();
    }
  });
}

async function handleToolLoop(
  sessionId: string,
  nickname: string,
  history: Message[],
  firstResult: { text: string; toolUses: { type: "tool_use"; id: string; name: string; input: Record<string, any> }[] }
): Promise<string> {
  let messages: any[] = history.map((m) => ({ role: m.role, content: m.content }));
  let currentResult = firstResult;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const assistantContent: any[] = [];
    if (currentResult.text) {
      assistantContent.push({ type: "text", text: currentResult.text });
    }
    for (const tu of currentResult.toolUses) {
      assistantContent.push({ type: "tool_use", id: tu.id, name: tu.name, input: tu.input });
    }
    messages.push({ role: "assistant", content: assistantContent });

    const toolResults: any[] = [];
    for (const tu of currentResult.toolUses) {
      const result = await handleToolUse(tu, nickname);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: result,
      });
    }
    messages.push({ role: "user", content: toolResults });

    recordApiUsage(sessionId);
    const nextResult = await sendWithToolResults(
      PLANNER_SYSTEM_PROMPT,
      messages,
      sessionId,
      TOOL_DEFINITIONS
    );

    if (nextResult.toolUses.length === 0) {
      const reply = nextResult.text || "작업을 완료했습니다.";
      conversation.addAssistantMessage(sessionId, reply);
      return reply;
    }

    currentResult = nextResult;
  }

  const reply = currentResult.text || "작업을 완료했습니다.";
  conversation.addAssistantMessage(sessionId, reply);
  return reply;
}

export function getChatHistory(sessionId: string): Message[] {
  return conversation.getHistory(sessionId);
}

export function clearChatHistory(sessionId: string): void {
  conversation.clearHistory(sessionId);
}
