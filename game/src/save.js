// Progress persistence: the campaign remembers itself in localStorage.
//
// Saved: the furthest wave reached, lifetime records, the campaign map's
// state (which islands are unlocked, cleared, and with how many stars),
// the achievements earned, and the player's mute and speed choices. A
// run itself is never saved mid-wave — HELIODROME is a sitting's game —
// but the campaign around it persists, and the title screen says so.

const SAVE_KEY = 'heliodrome-save-v2';

/** The blank save, used on first run or when storage is unavailable. */
function blankSave() {
  return {
    bestWave: 0,
    bestScore: 0,
    victories: 0,
    lifetimeKills: 0,
    muted: false,
    speed: 1,
    // Per-island campaign record: index-aligned with ISLANDS.
    islands: [0, 1, 2, 3, 4].map(() => ({ unlocked: false, cleared: false, stars: 0 })),
    achievements: [],
    runsPlayed: 0,
  };
}

/** Load the save, tolerating missing or corrupt data. */
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const fresh = blankSave();
      fresh.islands[0].unlocked = true;
      return fresh;
    }
    const parsed = JSON.parse(raw);
    const save = { ...blankSave(), ...parsed };
    if (!Array.isArray(save.islands) || save.islands.length !== 5) {
      save.islands = blankSave().islands;
    }
    save.islands[0].unlocked = true;
    if (!Array.isArray(save.achievements)) save.achievements = [];
    return save;
  } catch {
    const fresh = blankSave();
    fresh.islands[0].unlocked = true;
    return fresh;
  }
}

/** Persist the save; failures (private mode, quota) are ignored. */
export function storeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage is a courtesy, never a requirement.
  }
}

/** Fold a finished (or abandoned) run's records into the save. */
export function recordRun(save, world) {
  save.bestWave = Math.max(save.bestWave, world.wave);
  save.bestScore = Math.max(save.bestScore, world.score);
  save.lifetimeKills += world.stats.kills;
  save.runsPlayed += 1;
  if (world.result === 'victory') save.victories += 1;
  for (const id of world.achievements) {
    if (!save.achievements.includes(id)) save.achievements.push(id);
  }
  storeSave(save);
}

/**
 * Record an island cleared: stars for how clean it was (three for
 * flawless, two for three leaks or fewer, one for surviving at all),
 * and unlock the road onward.
 */
export function recordIsland(save, islandIndex, leaks) {
  const record = save.islands[islandIndex];
  if (!record) return;
  record.cleared = true;
  const stars = leaks === 0 ? 3 : leaks <= 3 ? 2 : 1;
  record.stars = Math.max(record.stars, stars);
  if (islandIndex + 1 < save.islands.length) {
    save.islands[islandIndex + 1].unlocked = true;
  }
  storeSave(save);
}

/** The highest island index the player may start from. */
export function highestUnlocked(save) {
  let best = 0;
  save.islands.forEach((record, i) => {
    if (record.unlocked) best = i;
  });
  return best;
}
