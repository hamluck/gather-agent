import { Client } from "@notionhq/client";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let notion: Client | null = null;

export function isNotionEnabled(): boolean {
  return !!(env.notion.apiKey && env.notion.tasksDbId);
}

function getClient(): Client {
  if (!notion) {
    notion = new Client({ auth: env.notion.apiKey });
  }
  return notion;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.status === 429) {
      logger.info("Notion rate limit hit, retrying in 1s...");
      await new Promise((r) => setTimeout(r, 1000));
      return fn();
    }
    throw err;
  }
}

export interface NotionTask {
  id?: string;
  title: string;
  assignee?: string;
  dueDate?: string;
  status?: string;
  description?: string;
}

export async function createTask(task: NotionTask): Promise<string> {
  const client = getClient();
  const properties: Record<string, any> = {
    "제목": { title: [{ text: { content: task.title } }] },
    "상태": { select: { name: task.status || "할 일" } },
  };
  if (task.assignee) {
    properties["담당자"] = { rich_text: [{ text: { content: task.assignee } }] };
  }
  if (task.dueDate) {
    properties["마감일"] = { date: { start: task.dueDate } };
  }
  if (task.description) {
    properties["설명"] = { rich_text: [{ text: { content: task.description } }] };
  }

  const page = await withRetry(() =>
    client.pages.create({
      parent: { database_id: env.notion.tasksDbId },
      properties,
    })
  );
  return page.id;
}

export async function updateTask(
  pageId: string,
  updates: Partial<NotionTask>
): Promise<void> {
  const client = getClient();
  const properties: Record<string, any> = {};
  if (updates.title) {
    properties["제목"] = { title: [{ text: { content: updates.title } }] };
  }
  if (updates.status) {
    properties["상태"] = { select: { name: updates.status } };
  }
  if (updates.assignee) {
    properties["담당자"] = { rich_text: [{ text: { content: updates.assignee } }] };
  }
  if (updates.dueDate) {
    properties["마감일"] = { date: { start: updates.dueDate } };
  }

  await withRetry(() =>
    client.pages.update({ page_id: pageId, properties })
  );
}

export async function listTasks(
  status?: string
): Promise<NotionTask[]> {
  const client = getClient();
  const filter: any = status
    ? { property: "상태", select: { equals: status } }
    : undefined;

  const response = await withRetry(() =>
    client.databases.query({
      database_id: env.notion.tasksDbId,
      filter,
      sorts: [{ property: "마감일", direction: "ascending" }],
    })
  );

  return response.results.map((page: any) => ({
    id: page.id,
    title: page.properties["제목"]?.title?.[0]?.plain_text || "",
    assignee: page.properties["담당자"]?.rich_text?.[0]?.plain_text || "",
    dueDate: page.properties["마감일"]?.date?.start || "",
    status: page.properties["상태"]?.select?.name || "",
    description: page.properties["설명"]?.rich_text?.[0]?.plain_text || "",
  }));
}

export async function createMeetingNote(meeting: {
  title: string;
  date: string;
  participants: string;
  summary: string;
  actionItems: string;
}): Promise<string> {
  if (!env.notion.meetingsDbId) {
    throw new Error("NOTION_MEETINGS_DB_ID not configured");
  }
  const client = getClient();
  const page = await withRetry(() =>
    client.pages.create({
      parent: { database_id: env.notion.meetingsDbId },
      properties: {
        "제목": { title: [{ text: { content: meeting.title } }] },
        "날짜": { date: { start: meeting.date } },
        "참석자": { rich_text: [{ text: { content: meeting.participants } }] },
      },
      children: [
        {
          object: "block" as const,
          type: "heading_2" as const,
          heading_2: { rich_text: [{ type: "text" as const, text: { content: "요약" } }] },
        },
        {
          object: "block" as const,
          type: "paragraph" as const,
          paragraph: { rich_text: [{ type: "text" as const, text: { content: meeting.summary } }] },
        },
        {
          object: "block" as const,
          type: "heading_2" as const,
          heading_2: { rich_text: [{ type: "text" as const, text: { content: "액션 아이템" } }] },
        },
        {
          object: "block" as const,
          type: "paragraph" as const,
          paragraph: { rich_text: [{ type: "text" as const, text: { content: meeting.actionItems } }] },
        },
      ],
    })
  );
  return page.id;
}

export async function listMeetings(): Promise<
  { id: string; title: string; date: string }[]
> {
  if (!env.notion.meetingsDbId) return [];
  const client = getClient();
  const response = await withRetry(() =>
    client.databases.query({
      database_id: env.notion.meetingsDbId,
      sorts: [{ property: "날짜", direction: "descending" }],
      page_size: 10,
    })
  );
  return response.results.map((page: any) => ({
    id: page.id,
    title: page.properties["제목"]?.title?.[0]?.plain_text || "",
    date: page.properties["날짜"]?.date?.start || "",
  }));
}
