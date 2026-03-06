import dotenv from "dotenv";
dotenv.config();

import { Client } from "@notionhq/client";

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const PARENT_PAGE_ID = process.argv[2];

if (!NOTION_API_KEY) {
  console.error("Error: NOTION_API_KEY is required in .env");
  process.exit(1);
}
if (!PARENT_PAGE_ID) {
  console.error("Usage: npx ts-node scripts/setup-notion-db.ts <parent-page-id>");
  console.error("  parent-page-id: Notion page ID where databases will be created");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });

async function createTasksDb(): Promise<string> {
  const db = await notion.databases.create({
    parent: { page_id: PARENT_PAGE_ID },
    title: [{ type: "text", text: { content: "태스크" } }],
    properties: {
      "제목": { title: {} },
      "상태": {
        select: {
          options: [
            { name: "할 일", color: "gray" },
            { name: "진행 중", color: "blue" },
            { name: "완료", color: "green" },
            { name: "취소", color: "red" },
          ],
        },
      },
      "담당자": { rich_text: {} },
      "마감일": { date: {} },
      "설명": { rich_text: {} },
    },
  });
  return db.id;
}

async function createMeetingsDb(): Promise<string> {
  const db = await notion.databases.create({
    parent: { page_id: PARENT_PAGE_ID },
    title: [{ type: "text", text: { content: "회의록" } }],
    properties: {
      "제목": { title: {} },
      "날짜": { date: {} },
      "참석자": { rich_text: {} },
    },
  });
  return db.id;
}

async function main() {
  console.log("Creating Notion databases...\n");

  const tasksDbId = await createTasksDb();
  console.log(`Tasks DB created: ${tasksDbId}`);

  const meetingsDbId = await createMeetingsDb();
  console.log(`Meetings DB created: ${meetingsDbId}`);

  console.log("\nAdd these to your .env file:");
  console.log(`NOTION_TASKS_DB_ID=${tasksDbId}`);
  console.log(`NOTION_MEETINGS_DB_ID=${meetingsDbId}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
