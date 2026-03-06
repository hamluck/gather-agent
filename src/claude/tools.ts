import { ToolDefinition, ToolUseResult } from "./client";
import * as notion from "../integrations/notion";
import { isNotionEnabled } from "../integrations/notion";
import { sendNotification, isSlackEnabled } from "../integrations/slack";
import { logger } from "../utils/logger";

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "create_task",
    description:
      "새로운 태스크를 생성합니다. 사용자가 할 일, 업무, 작업 등을 요청할 때 사용합니다.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "태스크 제목" },
        assignee: { type: "string", description: "담당자 이름 (선택)" },
        due_date: {
          type: "string",
          description: "마감일 (YYYY-MM-DD 형식, 선택)",
        },
        description: { type: "string", description: "태스크 설명 (선택)" },
      },
      required: ["title"],
    },
  },
  {
    name: "list_tasks",
    description:
      "태스크 목록을 조회합니다. 할 일 목록, 진행 상황 등을 물어볼 때 사용합니다.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["할 일", "진행 중", "완료", "취소"],
          description: "필터할 상태 (선택)",
        },
      },
    },
  },
  {
    name: "update_task",
    description:
      "태스크 상태를 변경합니다. 완료, 진행 중 등으로 변경할 때 사용합니다.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "태스크 ID" },
        status: {
          type: "string",
          enum: ["할 일", "진행 중", "완료", "취소"],
          description: "변경할 상태",
        },
      },
      required: ["task_id", "status"],
    },
  },
];

export async function handleToolUse(
  toolUse: ToolUseResult,
  sessionNickname: string
): Promise<string> {
  try {
    switch (toolUse.name) {
      case "create_task":
        return await handleCreateTask(toolUse.input, sessionNickname);
      case "list_tasks":
        return await handleListTasks(toolUse.input);
      case "update_task":
        return await handleUpdateTask(toolUse.input);
      default:
        return `알 수 없는 도구: ${toolUse.name}`;
    }
  } catch (err: any) {
    logger.error(`Tool use error (${toolUse.name})`, err.message);
    if (!isNotionEnabled()) {
      return "Notion이 연결되어 있지 않아 태스크 기능을 사용할 수 없습니다.";
    }
    return "Notion 연결에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }
}

async function handleCreateTask(
  input: Record<string, any>,
  sessionNickname: string
): Promise<string> {
  if (!isNotionEnabled()) {
    return "Notion이 연결되어 있지 않아 태스크를 생성할 수 없습니다.";
  }

  const task: notion.NotionTask = {
    title: input.title,
    assignee: input.assignee || sessionNickname,
    dueDate: input.due_date,
    status: "할 일",
    description: input.description,
  };

  const pageId = await notion.createTask(task);

  if (isSlackEnabled()) {
    const duePart = task.dueDate ? ` (마감: ${task.dueDate})` : "";
    sendNotification(
      `[태스크 생성] ${task.title}${duePart} - 담당: ${task.assignee || "미정"}`
    );
  }

  return JSON.stringify({
    success: true,
    id: pageId,
    title: task.title,
    assignee: task.assignee,
    dueDate: task.dueDate,
  });
}

async function handleListTasks(
  input: Record<string, any>
): Promise<string> {
  if (!isNotionEnabled()) {
    return "Notion이 연결되어 있지 않아 태스크를 조회할 수 없습니다.";
  }

  const tasks = await notion.listTasks(input.status);
  if (tasks.length === 0) {
    return JSON.stringify({ tasks: [], message: "태스크가 없습니다." });
  }
  return JSON.stringify({ tasks });
}

async function handleUpdateTask(
  input: Record<string, any>
): Promise<string> {
  if (!isNotionEnabled()) {
    return "Notion이 연결되어 있지 않아 태스크를 수정할 수 없습니다.";
  }

  await notion.updateTask(input.task_id, { status: input.status });
  return JSON.stringify({ success: true, taskId: input.task_id, status: input.status });
}
