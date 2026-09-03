import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const functions = [
  {
    name: "m4-rule-smoke",
    mustContain: ["resolvePlay"],
  },
  {
    name: "submit-play",
    mustContain: [
      "resolveServerPlayRequest",
      "SUPABASE_SERVICE_ROLE_KEY",
      "expected_state_version",
      "request_id",
      "authorization",
      "dry_run",
    ],
  },
];

for (const fn of functions) {
  const functionDir = path.join(root, "supabase", "functions", fn.name);
  const denoPath = path.join(functionDir, "deno.json");
  const indexPath = path.join(functionDir, "index.ts");

  const deno = JSON.parse(await readFile(denoPath, "utf8"));
  const index = await readFile(indexPath, "utf8");

  const gameCoreImport = deno.imports?.["@card-game-app/game-core/server"];
  if (gameCoreImport !== "../../../packages/game-core/src/server.ts") {
    throw new Error(
      `${fn.name}: unexpected game-core server import mapping: ${String(gameCoreImport)}`,
    );
  }

  if (!index.includes('from "@card-game-app/game-core/server"')) {
    throw new Error(`${fn.name}: must import the game-core server entrypoint`);
  }

  for (const token of fn.mustContain) {
    if (!index.includes(token)) {
      throw new Error(`${fn.name}: missing required token ${token}`);
    }
  }
}

console.log("M4 Edge Function config check passed");
