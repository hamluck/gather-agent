import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { logger } from "../utils/logger";

const client = new Anthropic({ apiKey: env.anthropic.apiKey });

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface ToolUseResult {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, any>;
}

function parseResponse(response: Anthropic.Message): { text: string; toolUses: ToolUseResult[] } {
  let text = "";
  const toolUses: ToolUseResult[] = [];

  for (const block of response.content) {
    if (block.type === "text") {
      text += block.text;
    } else if (block.type === "tool_use") {
      toolUses.push({
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: block.input as Record<string, any>,
      });
    }
  }

  return { text, toolUses };
}

export async function sendMessage(
  systemPrompt: string,
  messages: Message[],
  userId?: string,
  tools?: ToolDefinition[]
): Promise<{ text: string; toolUses: ToolUseResult[] }> {
  try {
    const params: any = {
      model: env.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    const response = await client.messages.create(params);
    return parseResponse(response);
  } catch (err: any) {
    logger.error("Claude API error", err.message);
    throw new Error("AI 응답을 생성하지 못했습니다. 잠시 후 다시 시도해주세요.");
  }
}

export async function sendWithToolResults(
  systemPrompt: string,
  messages: any[],
  userId?: string,
  tools?: ToolDefinition[]
): Promise<{ text: string; toolUses: ToolUseResult[] }> {
  try {
    const params: any = {
      model: env.anthropic.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    };
    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    const response = await client.messages.create(params);
    return parseResponse(response);
  } catch (err: any) {
    logger.error("Claude API error (tool results)", err.message);
    throw new Error("AI 응답을 생성하지 못했습니다.");
  }
}
