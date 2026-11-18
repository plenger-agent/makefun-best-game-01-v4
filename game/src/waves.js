// The wave director: what the dark sends, and when.
//
// A wave is a spawn schedule built from a budget. The budget grows with
// the wave number; the roster unlocks in a taught order across sixty
// waves and five islands (moths first, so the player learns the beam;
// burrowers when the road moves to the desert's far side; the
// Dreadnought when the Shoals are burning). Marquee waves — island
// arrivals, first nights, the Dreadnought's debut — are composed by
// hand in FEATURE_WAVES so their lessons land in order. Boss waves are
// built around their escort. Night waves skew fast and pale. Endless
// waves keep composing forever, richer and denser, cycling the islands.
//
// The director owns the between-wave rhythm too: a wave ends when its
// schedule is spent and the field is clear, and only then may the
// player open the spectrum tree and call the next wave.

import { BOSS_EVERY, CAMPAIGN_WAVES, NIGHT_EVERY } from './config.js';
import { islandForWave, islandForEndless } from './maps.js';
import { makeRng, hashSeed } from './rng.js';
import { spawnEnemy } from './enemies.js';

/** True when wave n is fought under the moonbeam. */
export function isNightWave(wave) {
  return wave % NIGHT_EVERY === 0;
}

/** True when wave n carries an aspect of THE ECLIPSE. */
export function isBossWave(wave) {
  return wave % BOSS_EVERY === 0;
}

/** Island index a wave is fought on (campaign ranges, then cycling). */
export function waveIslandIndex(wave) {
  return wave <= CAMPAIGN_WAVES ? islandForWave(wave) : islandForEndless(wave);
}

/** Roster in unlock order: [kind, firstWave, weight]. */
const ROSTER = [
  ['moth', 1, 10],
  ['crawler', 2, 6],
  ['wraith', 4, 5],
  ['swift', 6, 5],
  ['splitterbug', 8, 4],
  ['beetle', 9, 4],
  ['burrower', 14, 4],
  ['veil', 17, 3],
  ['shade', 22, 3],
  ['colossus', 27, 1],
  ['dreadnought', 34, 1],
];

/** Rough gold-value cost of one creature, for budgeting a wave. */
const BUDGET_COST = {
  moth: 1, crawler: 1.6, wraith: 1.8, swift: 2, splitterbug: 2.4,
  beetle: 3.4, burrower: 3.1, veil: 3.2, shade: 5, colossus: 12,
  dreadnought: 16, eclipse: 0,
};

/** Append a run of one kind to an event list; returns the next free time. */
function seq(events, kind, count, gap, at) {
  for (let i = 0; i < count; i += 1) {
    events.push({ kind, at });
    at += gap;
  }
  return at;
}

/**
 * Hand-composed marquee waves. Each teaches one thing: a new creature,
 * a new island's geometry, a new bargain. Everything not listed here is
 * budgeted by composeWave below.
 */
const FEATURE_WAVES = {
  // Wave 1: moths only, in two gentle packs. Learn the beam.
  1: (rng) => {
    const e = [];
    let at = seq(e, 'moth', 4, 0.7, 1.2);
    at = seq(e, 'moth', 5, 0.6, at + 2.2);
    return e;
  },
  // Wave 5: the first night. Swifts and wraiths under the moonbeam.
  5: (rng) => {
    const e = [];
    let at = seq(e, 'swift', 4, 0.45, 1.0);
    at = seq(e, 'wraith', 3, 0.8, at + 1.6);
    at = seq(e, 'swift', 5, 0.4, at + 1.2);
    at = seq(e, 'moth', 6, 0.5, at + 1.8);
    return e;
  },
  // Wave 13: Noon Desert arrival — a long crawler train on the switchbacks.
  13: (rng) => {
    const e = [];
    let at = seq(e, 'crawler', 6, 0.9, 1.0);
    at = seq(e, 'moth', 6, 0.5, at + 1.4);
    at = seq(e, 'crawler', 5, 0.9, at + 1.2);
    at = seq(e, 'wraith', 4, 0.7, at + 1.6);
    return e;
  },
  // Wave 14: something moves under the road. Burrowers, with moths above.
  14: (rng) => {
    const e = [];
    let at = seq(e, 'burrower', 2, 1.6, 1.2);
    at = seq(e, 'moth', 5, 0.5, at + 0.8);
    at = seq(e, 'burrower', 3, 1.5, at + 1.4);
    at = seq(e, 'crawler', 4, 0.9, at + 1.2);
    return e;
  },
  // Wave 25: Dusk Cliffs arrival — veils and wraiths around the spiral.
  25: (rng) => {
    const e = [];
    let at = seq(e, 'veil', 3, 1.1, 1.0);
    at = seq(e, 'wraith', 5, 0.7, at + 1.2);
    at = seq(e, 'beetle', 3, 1.2, at + 1.4);
    at = seq(e, 'veil', 3, 1.1, at + 1.2);
    at = seq(e, 'shade', 2, 1.6, at + 1.6);
    return e;
  },
  // Wave 34: the Dreadnought's debut, announced by a thin, fast screen.
  34: (rng) => {
    const e = [];
    let at = seq(e, 'swift', 6, 0.4, 1.0);
    at = seq(e, 'dreadnought', 1, 1, at + 3.2);
    at = seq(e, 'wraith', 4, 0.7, at + 2.0);
    at = seq(e, 'beetle', 3, 1.2, at + 1.4);
    return e;
  },
  // Wave 37: Ember Shoals arrival — husks and beetles over the causeway.
  37: (rng) => {
    const e = [];
    let at = seq(e, 'splitterbug', 4, 0.8, 1.0);
    at = seq(e, 'beetle', 4, 1.2, at + 1.2);
    at = seq(e, 'burrower', 3, 1.5, at + 1.2);
    at = seq(e, 'shade', 3, 1.5, at + 1.4);
    return e;
  },
  // Wave 49: Frostmere arrival — the first sheet, and things that skate.
  49: (rng) => {
    const e = [];
    let at = seq(e, 'swift', 6, 0.42, 1.0);
    at = seq(e, 'burrower', 3, 1.5, at + 1.2);
    at = seq(e, 'wraith', 5, 0.7, at + 1.2);
    at = seq(e, 'beetle', 3, 1.2, at + 1.4);
    return e;
  },
  // Wave 55: two Dreadnoughts, one road. The campaign's hardest hour.
  55: (rng) => {
    const e = [];
    let at = seq(e, 'veil', 4, 1.0, 1.0);
    at = seq(e, 'dreadnought', 1, 1, at + 2.4);
    at = seq(e, 'swift', 6, 0.4, at + 1.6);
    at = seq(e, 'dreadnought', 1, 1, at + 2.4);
    at = seq(e, 'shade', 3, 1.4, at + 1.6);
    return e;
  },
  // Wave 59: the last rush before the final eclipse — everything, fast.
  59: (rng) => {
    const e = [];
    let at = seq(e, 'swift', 8, 0.36, 0.8);
    at = seq(e, 'splitterbug', 5, 0.7, at + 0.8);
    at = seq(e, 'burrower', 4, 1.2, at + 0.8);
    at = seq(e, 'colossus', 1, 1, at + 1.2);
    at = seq(e, 'wraith', 6, 0.6, at + 0.8);
    at = seq(e, 'dreadnought', 1, 1, at + 1.6);
    return e;
  },
};

/**
 * Build the spawn schedule for a wave: a list of {kind, at} with `at` in
 * seconds from the wave's start. Deterministic per wave number, so a
 * wave plays the same for everyone who meets it.
 */
export function composeWave(wave) {
  const rng = makeRng(hashSeed(`heliodrome-wave-${wave}`));
  if (isBossWave(wave)) return composeBossWave(wave, rng);
  if (FEATURE_WAVES[wave]) return FEATURE_WAVES[wave](rng);

  let budget = 9 + wave * 2.3 + Math.pow(Math.max(0, wave - 30), 1.55);
  if (isNightWave(wave)) budget *= 0.92;
  const pool = ROSTER.filter(([, first]) => wave >= first);
  const events = [];
  let at = 1.2;
  let sincePack = 0;
  while (budget > 0) {
    const kind = pickKind(rng, pool, wave);
    const packSize = packOf(rng, kind);
    for (let i = 0; i < packSize; i += 1) {
      events.push({ kind, at });
      at += intervalOf(kind, wave);
      budget -= BUDGET_COST[kind];
      if (budget <= 0) break;
    }
    sincePack += 1;
    at += rng.range(0.7, 2.1); // A breath between packs.
    if (sincePack > 44) break;
  }
  return events;
}

/** Weighted pick from the unlocked roster; nights favour the fast and pale. */
function pickKind(rng, pool, wave) {
  let total = 0;
  const weights = pool.map(([kind, , weight]) => {
    let w = weight;
    if (isNightWave(wave) && (kind === 'swift' || kind === 'wraith')) w *= 1.9;
    if (isNightWave(wave) && kind === 'beetle') w *= 0.4;
    if (wave >= 49 && kind === 'swift') w *= 1.4; // Frostmere loves skaters.
    total += w;
    return w;
  });
  let roll = rng.next() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return pool[i][0];
  }
  return pool[0][0];
}

/** How many of a kind arrive together. */
function packOf(rng, kind) {
  switch (kind) {
    case 'moth': return rng.int(3, 6);
    case 'swift': return rng.int(2, 5);
    case 'wraith': return rng.int(2, 4);
    case 'crawler': return rng.int(2, 3);
    case 'splitterbug': return rng.int(1, 3);
    case 'burrower': return rng.int(1, 3);
    case 'colossus': return 1;
    case 'dreadnought': return 1;
    case 'shade': return rng.int(1, 2);
    default: return rng.int(1, 2);
  }
}

/** Seconds between individuals inside a pack. */
function intervalOf(kind, wave) {
  const base = {
    moth: 0.55, swift: 0.4, wraith: 0.7, crawler: 0.9, splitterbug: 0.8,
    beetle: 1.1, burrower: 1.3, veil: 1.0, shade: 1.4, colossus: 2, dreadnought: 2.4,
  }[kind] || 0.8;
  return base * Math.max(0.55, 1 - wave * 0.007);
}

/**
 * Boss waves: a thin escort first, to make the player spend attention,
 * then THE ECLIPSE at the half-minute with a honour guard behind it.
 * Later eclipses arrive with heavier guards and, from wave 40, a
 * Dreadnought walking in the disc's shadow.
 */
function composeBossWave(wave, rng) {
  const events = [];
  let at = 1.0;
  const escort = Math.min(18, 5 + wave / 3);
  for (let i = 0; i < escort; i += 1) {
    events.push({ kind: rng.pick(['moth', 'wraith', 'crawler', 'swift']), at });
    at += rng.range(0.5, 1.0);
  }
  at += 4;
  events.push({ kind: 'eclipse', at });
  at += 6;
  const guard = Math.min(12, 3 + wave / 5);
  for (let i = 0; i < guard; i += 1) {
    events.push({ kind: rng.pick(['beetle', 'veil', 'shade', 'burrower']), at });
    at += rng.range(1.2, 2.2);
  }
  if (wave >= 40) {
    at += 3;
    events.push({ kind: 'dreadnought', at });
  }
  return events;
}

/** Create the runtime director state for a fresh campaign. */
export function makeDirector() {
  return {
    phase: 'build', // build | spawning | fighting | cleared
    schedule: [],
    cursor: 0,
    clock: 0,
    spawned: 0,
    totalToSpawn: 0,
  };
}

/** Begin a wave: compose its schedule and reset the clock. */
export function startWave(world) {
  const director = world.director;
  director.schedule = composeWave(world.wave);
  director.totalToSpawn = director.schedule.length;
  director.cursor = 0;
  director.clock = 0;
  director.spawned = 0;
  director.phase = 'spawning';
  world.night = isNightWave(world.wave);
}

/** Spawn whatever is due; move the phase along when the schedule ends. */
export function updateDirector(world, dt) {
  const director = world.director;
  if (director.phase !== 'spawning') return;
  director.clock += dt;
  while (director.cursor < director.schedule.length && director.schedule[director.cursor].at <= director.clock) {
    spawnEnemy(world, director.schedule[director.cursor].kind);
    director.cursor += 1;
    director.spawned += 1;
  }
  if (director.cursor >= director.schedule.length) director.phase = 'fighting';
}

/** A short human label for the incoming wave, for the HUD and banners. */
export function waveTitle(wave) {
  if (isBossWave(wave)) return `Wave ${wave} — THE ECLIPSE`;
  if (isNightWave(wave)) return `Wave ${wave} — Nightfall`;
  return `Wave ${wave}`;
}

/** Banner sub-lines for island arrivals and first meetings. */
export const WAVE_NOTES = {
  1: 'Place a mirror. Bend the noon. Press SPACE to call the first wave.',
  5: 'The moonbeam slows more than it burns. In shadow, the shades surge.',
  13: 'Noon Desert. The road doubles back — one prism can hold two straights.',
  14: 'Deepburrowers! They travel underground, where no light reaches.',
  25: 'Dusk Cliffs. The spiral is shadowed: umbral and chrono glass earn their keep.',
  34: 'A Dreadnought walks the road. Plated in shade — burn it long, or slow it longer.',
  37: 'Ember Shoals. Ash clouds cross the sun here — route the light around their shade.',
  49: 'Frostmere. The road is ice: shades skate fast until your beam melts it open.',
  60: 'The last noon. Everything the dark has left, it sends now.',
};
