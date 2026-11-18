// The five islands: shade paths, build pads, ice, and dressing.
//
// Each island is one winding polyline the shades walk from the shadow
// edge (a cave mouth drawn at the first point) to the Heart Crystal
// (drawn at the last), plus a set of build pads — stone circles where
// towers may stand. Pads sit close enough to the road that a beam
// steered across two or three of them can rake long stretches of it,
// which is the whole game: the sun only ever shines from one side, so
// the player's mirrors decide where the light actually falls.
//
// Frostmere adds a second geography: sheets of lake ice frozen over the
// road. Shades skate fast on unbroken ice; a beam held on a sheet melts
// it to open water, and open water slows them instead. The ice is part
// of the map, but its melt state belongs to the run (world.js).
//
// Coordinates are in the logical 1280x800 field; the ground rectangle is
// x 24..1256, y 128..688 (see config.js).

import { GROUND, WAVES_PER_ISLAND, ISLAND_ART } from './config.js';
import { makeRng, hashSeed } from './rng.js';

/** One island definition: path, pads, ice, and where the crystal stands. */
function island(name, path, pads, dressingSeed, icePatches = []) {
  return {
    name,
    path,
    pads: pads.map(([x, y]) => ({ x, y })),
    crystal: path[path.length - 1],
    gate: path[0],
    icePatches,
    dressing: makeDressing(name, dressingSeed),
  };
}

/** Dressing vocabulary per biome: [kind, relative weight] pairs. */
const DRESSING_KINDS = {
  coast: [['grass', 10], ['flower', 5], ['pebble', 4], ['shell', 3], ['rock', 3], ['rune', 1]],
  desert: [['crack', 6], ['pebble', 5], ['drytuft', 5], ['rock', 4], ['bones', 1], ['rune', 1]],
  cliffs: [['stone', 6], ['moss', 5], ['pebble', 4], ['rock', 4], ['flower', 2], ['rune', 1]],
  shoals: [['lavarock', 6], ['vent', 3], ['ash', 6], ['rock', 4], ['pebble', 3], ['rune', 1]],
  frost: [['drift', 6], ['iceshard', 4], ['pine', 3], ['pebble', 3], ['rock', 3], ['flower', 1]],
};

/**
 * Deterministic set dressing: two hundred small pieces of terrain
 * texture scattered over the island — grass blades, flowers, pebbles,
 * cracked earth, snow drifts — drawn by the renderer's ground painter.
 * Points too near the road or a pad are skipped at paint time, which
 * knows both; the list itself is pure data.
 */
function makeDressing(name, seed) {
  const art = ISLAND_ART.find((a) => a.name === name) || ISLAND_ART[0];
  const kinds = DRESSING_KINDS[art.biome];
  const totalWeight = kinds.reduce((sum, [, w]) => sum + w, 0);
  const rng = makeRng(hashSeed(name) ^ seed);
  const items = [];
  for (let i = 0; i < 210; i += 1) {
    let roll = rng.next() * totalWeight;
    let kind = kinds[0][0];
    for (const [k, w] of kinds) {
      roll -= w;
      if (roll <= 0) { kind = k; break; }
    }
    items.push({
      x: GROUND.x + rng.range(8, GROUND.width - 8),
      y: GROUND.y + rng.range(8, GROUND.height - 8),
      kind,
      size: rng.range(3, 10),
      shade: rng.range(-0.18, 0.18),
      spin: rng.range(0, Math.PI * 2),
      flip: rng.chance(0.5) ? -1 : 1,
    });
  }
  return items;
}

/**
 * Dawn Coast: a lazy S from the west cave, down the beach and up to the
 * crystal on its eastern headland. Long straights favour gilded mirrors;
 * the shore runs along the south edge, all foam and shells.
 */
const DAWN_COAST = island(
  'Dawn Coast',
  [
    { x: 8, y: 300 }, { x: 190, y: 300 }, { x: 300, y: 210 }, { x: 470, y: 210 },
    { x: 560, y: 330 }, { x: 560, y: 470 }, { x: 700, y: 540 }, { x: 900, y: 540 },
    { x: 1010, y: 430 }, { x: 1010, y: 260 }, { x: 1130, y: 200 }, { x: 1248, y: 200 },
  ],
  [
    [140, 380], [250, 250], [390, 290], [390, 140], [520, 260], [640, 400],
    [480, 520], [640, 590], [800, 470], [800, 610], [930, 350], [1090, 330],
    [1090, 480], [1160, 280], [180, 190], [950, 610], [250, 420], [720, 300],
  ],
  101,
);

/**
 * Noon Desert: a switchback canyon. The road doubles back on itself
 * three times, so one well-placed prism can hold two straights in its
 * fan. The earth is cracked dry; nothing here casts a shadow but you.
 */
const NOON_DESERT = island(
  'Noon Desert',
  [
    { x: 8, y: 190 }, { x: 330, y: 190 }, { x: 430, y: 280 }, { x: 430, y: 400 },
    { x: 250, y: 470 }, { x: 250, y: 580 }, { x: 560, y: 640 }, { x: 860, y: 640 },
    { x: 960, y: 540 }, { x: 960, y: 300 }, { x: 1080, y: 220 }, { x: 1248, y: 220 },
  ],
  [
    [180, 270], [180, 110], [360, 320], [540, 340], [560, 470], [380, 540],
    [700, 560], [700, 630], [880, 450], [1060, 380], [1060, 560], [1160, 300],
    [520, 200], [820, 240], [330, 640], [1150, 620], [620, 250], [480, 600],
  ],
  202,
);

/**
 * Dusk Cliffs: a spiral into the caldera where the crystal waits. The
 * innermost loop is in shadow of the rim for much of the day — umbral
 * and chrono glass earn their keep here.
 */
const DUSK_CLIFFS = island(
  'Dusk Cliffs',
  [
    { x: 8, y: 620 }, { x: 300, y: 620 }, { x: 460, y: 520 }, { x: 460, y: 240 },
    { x: 640, y: 160 }, { x: 1020, y: 160 }, { x: 1140, y: 280 }, { x: 1140, y: 520 },
    { x: 1000, y: 610 }, { x: 720, y: 610 }, { x: 640, y: 500 }, { x: 760, y: 400 },
    { x: 880, y: 400 },
  ],
  [
    [170, 540], [330, 650], [560, 420], [560, 300], [800, 240], [800, 130],
    [1020, 300], [1020, 460], [880, 540], [720, 420], [620, 580], [960, 630],
    [240, 380], [380, 160], [1080, 640], [500, 640], [660, 260], [340, 460],
  ],
  303,
);

/**
 * Ember Shoals: a causeway over black glass and lava pools, zig-zagging
 * between vents. The road is short and brutal; the ash clouds are the
 * real enemy — when one crosses the sun, every mirror goes blind.
 */
const EMBER_SHOALS = island(
  'Ember Shoals',
  [
    { x: 8, y: 220 }, { x: 260, y: 220 }, { x: 360, y: 330 }, { x: 360, y: 480 },
    { x: 520, y: 570 }, { x: 760, y: 570 }, { x: 860, y: 460 }, { x: 860, y: 250 },
    { x: 1000, y: 170 }, { x: 1248, y: 170 },
  ],
  [
    [150, 300], [270, 130], [470, 270], [470, 420], [250, 420], [620, 480],
    [640, 640], [760, 360], [960, 340], [960, 560], [1080, 250], [1130, 420],
    [560, 180], [180, 560], [1060, 640], [420, 620], [900, 120], [700, 260],
  ],
  404,
);

/**
 * Frostmere: the road crosses a frozen lake three times. On unbroken
 * ice the shades skate half again as fast; hold the beam on a sheet to
 * melt it, and the open water drags at their feet instead. The last
 * sheet guards the crystal itself.
 */
const FROSTMERE = island(
  'Frostmere',
  [
    { x: 8, y: 480 }, { x: 240, y: 480 }, { x: 340, y: 380 }, { x: 340, y: 210 },
    { x: 540, y: 150 }, { x: 780, y: 150 }, { x: 880, y: 250 }, { x: 880, y: 430 },
    { x: 760, y: 520 }, { x: 520, y: 520 }, { x: 430, y: 610 }, { x: 640, y: 660 },
    { x: 900, y: 660 }, { x: 1080, y: 580 }, { x: 1248, y: 580 },
  ],
  [
    [140, 400], [150, 580], [440, 300], [440, 450], [560, 250], [680, 240],
    [790, 330], [990, 320], [990, 470], [650, 420], [620, 590], [800, 600],
    [1010, 640], [1150, 490], [250, 300], [560, 640], [950, 180], [380, 120],
  ],
  505,
  [
    { x: 300, y: 440, rx: 120, ry: 62 },
    { x: 660, y: 152, rx: 130, ry: 58 },
    { x: 872, y: 340, rx: 96, ry: 110 },
    { x: 1120, y: 586, rx: 118, ry: 60 },
  ],
);

/** The campaign's islands, in order. Wave ranges map onto them in waves.js. */
export const ISLANDS = [DAWN_COAST, NOON_DESERT, DUSK_CLIFFS, EMBER_SHOALS, FROSTMERE];

/** Island index for a campaign wave (1-based): twelve waves each. */
export function islandForWave(wave) {
  const index = Math.floor((wave - 1) / WAVES_PER_ISLAND);
  return Math.min(ISLANDS.length - 1, Math.max(0, index));
}

/** In endless mode the islands cycle and the paths mirror for variety. */
export function islandForEndless(wave) {
  return (wave - 1) % ISLANDS.length;
}

/** The first campaign wave fought on an island (1-based). */
export function firstWaveOfIsland(islandIndex) {
  return islandIndex * WAVES_PER_ISLAND + 1;
}

/** The last campaign wave fought on an island (1-based). */
export function lastWaveOfIsland(islandIndex) {
  return (islandIndex + 1) * WAVES_PER_ISLAND;
}
