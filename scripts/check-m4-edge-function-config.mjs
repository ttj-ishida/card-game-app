import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const functionDir = path.join(root, "supabase", "functions", "m4-rule-smoke");
const denoPath = path.join(functionDir, "deno.json");
const indexPath = path.join(functionDir, "index.ts");

const deno = JSON.parse(await readFile(denoPath, "utf8"));
const index = await readFile(indexPath, "utf8");

const gameCoreImport = deno.imports?.["@card-game-app/game-core/server"];
if (gameCoreImport !== "../../../packages/game-core/src/server.ts") {
  throw new Error(
    `Unexpected game-core server import mapping: ${String(gameCoreImport)}`,
  );
}

if (!index.includes('from "@card-game-app/game-core/server"')) {
  throw new Error("m4-rule-smoke must import the game-core server entrypoint");
}

if (!index.includes("resolvePlay")) {
  throw new Error("m4-rule-smoke must exercise resolvePlay");
}

console.log("M4 Edge Function config check passed");
