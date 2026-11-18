// Achievements: twelve small honours for playing the light well.
//
// Each achievement is a predicate over the run's story so far, checked
// at the moments that can change it (a kill, a leak, a wave clearing,
// an island falling, a sheet of ice melting). Unlocking one is a small
// ceremony: a toast at the top of the field, a burst of gold sparks, a
// chime — and a permanent line in the save, so the title screen and the
// codex can remember what the player has done across every run.

/** The twelve honours. `test` reads a snapshot the world assembles. */
export const ACHIEVEMENTS = [
  {
    id: 'first-blood', name: 'First Light', icon: '☀',
    text: 'Burn your first shade.',
    test: (s) => s.kills >= 1,
  },
  {
    id: 'ash-century', name: 'Century of Ash', icon: '✦',
    text: 'Burn 100 shades in a single run.',
    test: (s) => s.kills >= 100,
  },
  {
    id: 'ash-millennium', name: 'Thousand Suns', icon: '❖',
    text: 'Burn 1,000 shades across all runs.',
    test: (s) => s.lifetimeKills >= 1000,
  },
  {
    id: 'flawless-island', name: 'Untouched Crystal', icon: '◆',
    text: 'Clear an island without losing a single life on it.',
    test: (s) => s.flawlessIslands >= 1,
  },
  {
    id: 'boss-breaker', name: 'Eclipse Breaker', icon: '☾',
    text: 'Shatter an aspect of THE ECLIPSE.',
    test: (s) => s.bossesBroken >= 1,
  },
  {
    id: 'dreadnought-down', name: 'Platebreaker', icon: '⚒',
    text: 'Bring down a Dreadnought Shade.',
    test: (s) => s.dreadnoughtsDown >= 1,
  },
  {
    id: 'rich-keeper', name: 'Keeper of the Mint', icon: '⬢',
    text: 'Hold 600 gold at once.',
    test: (s) => s.gold >= 600,
  },
  {
    id: 'architect', name: 'Forest of Glass', icon: '⬡',
    text: 'Have 12 towers standing at once.',
    test: (s) => s.towersStanding >= 12,
  },
  {
    id: 'full-spectrum', name: 'The Whole Spectrum', icon: '◈',
    text: 'Stand all eight kinds of glass at once.',
    test: (s) => s.towerKinds >= 8,
  },
  {
    id: 'night-owl', name: 'Night Owl', icon: '🦉',
    text: 'Clear five night waves in one run.',
    test: (s) => s.nightsCleared >= 5,
  },
  {
    id: 'melter', name: 'Thawbringer', icon: '≈',
    text: 'Melt three sheets of Frostmere ice in one run.',
    test: (s) => s.sheetsMelted >= 3,
  },
  {
    id: 'endless-noon', name: 'The Sun Refuses', icon: '∞',
    text: 'Reach wave 70 in Endless Noon.',
    test: (s) => s.wave >= 70 && s.endless,
  },
];

/** Look an achievement up by id (codex and end panels use this). */
export function achievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}

/**
 * Assemble the snapshot the predicates read. Cheap on purpose: it is
 * rebuilt only at event moments, never per frame.
 */
export function snapshot(world) {
  const kinds = new Set(world.towers.map((t) => t.kind));
  return {
    kills: world.stats.kills,
    lifetimeKills: (world.save?.lifetimeKills || 0) + world.stats.kills,
    flawlessIslands: world.stats.flawlessIslands,
    bossesBroken: world.stats.bossesBroken,
    dreadnoughtsDown: world.stats.dreadnoughtsDown,
    gold: world.gold,
    towersStanding: world.towers.length,
    towerKinds: kinds.size,
    nightsCleared: world.stats.nightsCleared,
    sheetsMelted: world.stats.sheetsMelted,
    wave: world.wave,
    endless: world.endless,
  };
}

/**
 * Check every locked achievement against the world; unlock the newly
 * earned, queue their toasts, and persist them. Returns the unlocked
 * defs (the caller plays the chime). Called by world.js at the event
 * moments listed above.
 */
export function checkAchievements(world) {
  const snap = snapshot(world);
  const fresh = [];
  for (const def of ACHIEVEMENTS) {
    if (world.achievements.has(def.id)) continue;
    if (!def.test(snap)) continue;
    world.achievements.add(def.id);
    fresh.push(def);
    world.toasts.push({ title: def.name, sub: def.text, icon: def.icon, t: 0, ttl: 4.2 });
  }
  return fresh;
}
