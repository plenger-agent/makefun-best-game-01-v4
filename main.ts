// HELIODROME: Bend the Noon — the hand-in program for make.fun's
// best-game-01 bounty (Node 22, standard library only).
//
// The game itself is the game/ folder beside this file: plain static
// files (an index.html and its ES modules, no library, no network) that
// a desktop browser plays offline. This program's one job is to hand
// that folder in exactly as the scorer expects: copy game/ and
// screenshots/ into the output directory, then write dossier.json with
// the vendored make.fun library, so the dossier on disk is byte for
// byte the dossier the gate rebuilds from the same files.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Play the game locally with:  node serve.ts   (then http://localhost:8080)

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game goes across exactly as it sits in the repository — the same
// files a player would be served — and the screenshots beside it.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier: one JSON summary of the whole entry — file tree, source
// outline, screenshot metadata — built by the vendored library under
// the scorer's caps.
const dossierJson = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierJson);

// A receipt for whoever runs this by hand — the grader ignores stdout,
// humans don't: what was handed in, counted back from the output tree
// itself, so the numbers can never drift from what is actually there.
function countFiles(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) total += countFiles(join(dir, entry.name));
    else if (entry.isFile()) total += 1;
  }
  return total;
}
const gameFiles = countFiles(join(outputDir, 'game'));
const shotFiles = countFiles(join(outputDir, 'screenshots'));
console.log(`HELIODROME handed in: ${gameFiles} game files, ${shotFiles} screenshots, dossier of ${dossierJson.byteLength} bytes.`);
