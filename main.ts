// HELIODROME — delivery program for our best-game-01 entry.
//
// Running this file packs the entry into the folder the grader reads:
// the playable game and its screenshots are mirrored across, then the
// dossier describing them is generated and dropped alongside. The
// destination comes from MAKEFUN_OUTPUT_DIR when the platform sets it
// and falls back to /output for a plain local run.

import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as funLib from "./vendor/makefun-game.ts";

const plan = {
  banner: "HELIODROME",
  envKey: "MAKEFUN_OUTPUT_DIR",
  fallbackDir: "/output",
  payloads: [
    { folder: "game", label: "game files" },
    { folder: "screenshots", label: "screenshots" },
  ],
  // The bounty's gate limits, spelled as arithmetic so the magnitudes
  // stay obvious: a 160 KiB text budget, four shots of 256 KiB at most,
  // 993 game entries under 48 MiB, no path longer than 1000 bytes.
  gate: {
    text_max_bytes: 160 * 1024,
    screenshots: { max: 4, max_bytes: 256 * 1024 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  },
};

const repoRoot = fileURLToPath(new URL(".", import.meta.url));

// Mirror one directory tree into place, counting the files carried
// over so the receipt can say how much was delivered.
function mirrorTree(sourceDir: string, targetDir: string): number {
  mkdirSync(targetDir, { recursive: true });
  let carried = 0;
  const names = readdirSync(sourceDir).sort();
  for (const name of names) {
    const from = join(sourceDir, name);
    const to = join(targetDir, name);
    if (statSync(from).isDirectory()) {
      carried += mirrorTree(from, to);
    } else {
      copyFileSync(from, to);
      carried += 1;
    }
  }
  return carried;
}

// A game with no front page is not a game at all; refuse to pack one
// rather than hand the grader a broken entry.
function checkPlayable(): void {
  const frontPage = join(repoRoot, "game", "index.html");
  let isFile = false;
  try {
    isFile = statSync(frontPage).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) throw new Error("game/index.html is missing, so there is nothing playable to pack");
}

function packEntry(): string {
  checkPlayable();
  const outbox = process.env[plan.envKey] ?? plan.fallbackDir;
  mkdirSync(outbox, { recursive: true });

  const manifest: string[] = [];
  for (const item of plan.payloads) {
    const destination = join(outbox, item.folder);
    // A stale copy from an earlier pack must never leak into this one.
    rmSync(destination, { recursive: true, force: true });
    const count = mirrorTree(join(repoRoot, item.folder), destination);
    manifest.push(count + " " + item.label);
  }

  const dossier = funLib.buildDossier(outbox, plan.gate);
  writeFileSync(join(outbox, "dossier.json"), dossier);

  return plan.banner + " packed for judging: " + manifest.join(" and ") +
    " delivered; dossier.json runs to " + dossier.length + " bytes.";
}

try {
  console.log(packEntry());
} catch (problem) {
  console.error("hand-in failed:", problem);
  process.exitCode = 1;
}
