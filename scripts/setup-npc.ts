import dotenv from "dotenv";
dotenv.config();

const GATHER_API_KEY = process.env.GATHER_API_KEY;
const GATHER_SPACE_ID = process.env.GATHER_SPACE_ID;
const EMBED_URL = process.env.EMBED_URL || "https://your-server.com";
const MAP_ID = process.env.GATHER_MAP_ID || "custom-entrance";
const NPC_X = parseInt(process.env.NPC_X || "10");
const NPC_Y = parseInt(process.env.NPC_Y || "10");

if (!GATHER_API_KEY || !GATHER_SPACE_ID) {
  console.error("GATHER_API_KEY and GATHER_SPACE_ID are required in .env");
  process.exit(1);
}

async function setupNpc() {
  const spaceId = GATHER_SPACE_ID!.replace("\\", "%5C");
  const url = `https://api.gather.town/api/v2/spaces/${spaceId}/maps/${MAP_ID}`;

  const objectId = "planner-claude-npc";
  const object = {
    id: objectId,
    type: 7, // Embedded Website
    x: NPC_X,
    y: NPC_Y,
    width: 1,
    height: 1,
    distThreshold: 3,
    previewMessage: "X를 눌러 기획자 Claude와 대화하세요",
    properties: {
      url: EMBED_URL,
    },
    normal: "https://cdn.gather.town/v0/b/gather-town.appspot.com/o/internal-dashboard-upload%2FJ0BQHJ9s5nMBfFnb?alt=media&token=default",
  };

  console.log(`Setting up NPC at (${NPC_X}, ${NPC_Y}) on map "${MAP_ID}"...`);
  console.log(`Embed URL: ${EMBED_URL}`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GATHER_API_KEY}`,
      },
      body: JSON.stringify({
        objects: { [objectId]: object },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed: ${res.status} ${text}`);
      process.exit(1);
    }

    console.log("NPC object placed successfully!");
    console.log("Go to your Gather space and look for the NPC.");
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

setupNpc();
