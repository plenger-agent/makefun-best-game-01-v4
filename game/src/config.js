// HELIODROME: Bend the Noon — shared constants, palettes and tuning.
//
// Everything the other modules agree on lives here: the logical field
// size, the spectrum colours and what each colour does to a shade, the
// tower catalogue, the shade roster, the campaign's shape (sixty waves,
// five islands), and the per-island art direction the renderer paints
// from. Numbers are tuned so a first-time player survives island one on
// mirrors alone, needs the full spectrum by island three, and meets a
// genuinely new problem — ash clouds, then melting ice — on four and five.

/** Logical canvas size; the renderer scales this to the window. */
export const FIELD = { width: 1280, height: 800 };

/** The strip at the top of the field where the sky, sun and HUD live. */
export const SKY_HEIGHT = 118;

/** The strip at the bottom where the build bar and tower cards live. */
export const BAR_HEIGHT = 92;

/** Playable ground rectangle (between sky and bar). */
export const GROUND = {
  x: 24,
  y: SKY_HEIGHT + 10,
  width: FIELD.width - 48,
  height: FIELD.height - SKY_HEIGHT - BAR_HEIGHT - 20,
};

/** The beam may travel this far in total before it is spent. */
export const BEAM_MAX_LENGTH = 3600;

/** The beam may reflect or split at most this many times per trace. */
export const BEAM_MAX_EVENTS = 34;

/** Beam half-width in pixels: creatures within this of a segment are lit. */
export const BEAM_RADIUS = 15;

/** Fixed simulation step, seconds. The render loop accumulates real time. */
export const STEP = 1 / 60;

/** Waves in the campaign; endless mode continues past the last one. */
export const CAMPAIGN_WAVES = 60;

/** Each island hosts this many campaign waves before the road moves on. */
export const WAVES_PER_ISLAND = 12;

/** Every fifth wave is a night wave lit by the moonbeam instead. */
export const NIGHT_EVERY = 5;

/** A boss — an aspect of THE ECLIPSE — arrives every tenth wave. */
export const BOSS_EVERY = 10;

/**
 * The spectrum. Sunlight starts WHITE; a prism fans it into EMBER (burn),
 * GILDED (raw damage) and UMBRAL (slow). A Chrono Lens bends whatever
 * passes through it toward CHRONO time — pale cyan light that barely
 * burns but holds a shade almost still. MOON is the night beam's colour:
 * weak at burning, but its slow is deep and long.
 */
export const SPECTRUM = {
  white: { name: 'Sunlight', css: '#fff3c4', core: '#fffbe8', dps: 26, burn: 0, slow: 0, slowTime: 0 },
  ember: { name: 'Ember', css: '#ff7a3c', core: '#ffd9a0', dps: 9, burn: 16, slow: 0, slowTime: 0 },
  gilded: { name: 'Gilded', css: '#ffc93c', core: '#fff3b0', dps: 46, burn: 0, slow: 0, slowTime: 0 },
  umbral: { name: 'Umbral', css: '#9a6bff', core: '#e2d4ff', dps: 6, burn: 0, slow: 0.45, slowTime: 0.7 },
  chrono: { name: 'Chrono', css: '#67e8f9', core: '#e0fbff', dps: 13, burn: 0, slow: 0.62, slowTime: 1.5 },
  moon: { name: 'Moonlight', css: '#bcd3ff', core: '#eef4ff', dps: 11, burn: 0, slow: 0.35, slowTime: 1.1 },
};

/** Tower catalogue: build cost, footprint radius, hotkey and role. */
export const TOWERS = {
  mirror: { name: 'Mirror', cost: 40, radius: 17, key: '1', blurb: 'Bends the beam. Rotate it to steer the light.' },
  prism: { name: 'Prism', cost: 90, radius: 18, key: '2', blurb: 'Splits sunlight into Ember, Gilded and Umbral.' },
  lens: { name: 'Lens Focuser', cost: 110, radius: 18, key: '3', blurb: 'Focuses the beam: +80% damage, longer reach.' },
  splitter: { name: 'Splitter', cost: 130, radius: 18, key: '4', blurb: 'Forks the beam in two at half strength.' },
  bell: { name: 'Dawn Bell', cost: 150, radius: 19, key: '5', blurb: 'Rings at dawn: slows every shade on the field.' },
  shard: { name: 'Eclipse Shard', cost: 220, radius: 19, key: '6', blurb: 'Stores sunlight, then fires it as a piercing lance.' },
  chrono: { name: 'Chrono Lens', cost: 170, radius: 18, key: '7', blurb: 'Bends time: light through it holds shades almost still.' },
  storm: { name: 'Storm Prism', cost: 200, radius: 19, key: '8', blurb: 'Fans the beam five ways and calls chain lightning.' },
};

/** Short tag shown under each tower card in the build bar. */
export const TOWER_TAGS = {
  mirror: 'rotates', prism: '3 colours', lens: '+80% dmg', splitter: '2 beams',
  bell: 'slow aura', shard: 'lance', chrono: 'time-slow', storm: '5-way fan',
};

/** Sell price is this share of everything spent on the tower. */
export const SELL_SHARE = 0.7;

/** Upgrade cost per level already bought (levels 1..3). */
export const UPGRADE_COST = [70, 130, 240];

/** Each upgrade level multiplies the tower's beam effect by this. */
export const UPGRADE_POWER = 1.35;

/**
 * The shade roster. hp/speed are island-one values; waves scale them.
 * `leak` is the lives the Heart Crystal loses when the creature arrives.
 * `shadeHeal` is health regained per second while the creature is in
 * shadow. `armour` is a flat damage reduction some kinds are born with.
 */
export const ENEMIES = {
  moth: { name: 'Duskmoth', hp: 30, speed: 52, reward: 6, leak: 1, shadeHeal: 2, radius: 11, armour: 0 },
  crawler: { name: 'Gloomcrawler', hp: 85, speed: 34, reward: 9, leak: 1, shadeHeal: 4, radius: 14, armour: 0 },
  wraith: { name: 'Pale Wraith', hp: 55, speed: 74, reward: 11, leak: 1, shadeHeal: 3, radius: 12, armour: 0 },
  swift: { name: 'Nightswift', hp: 42, speed: 118, reward: 12, leak: 1, shadeHeal: 2, radius: 10, armour: 0 },
  splitterbug: { name: 'Mitosis Husk', hp: 120, speed: 44, reward: 10, leak: 1, shadeHeal: 5, radius: 14, armour: 0 },
  beetle: { name: 'Umbral Beetle', hp: 240, speed: 26, reward: 16, leak: 2, shadeHeal: 8, radius: 17, armour: 0.1 },
  burrower: { name: 'Deepburrower', hp: 170, speed: 47, reward: 14, leak: 1, shadeHeal: 5, radius: 13, armour: 0 },
  veil: { name: 'Veilspinner', hp: 160, speed: 58, reward: 18, leak: 1, shadeHeal: 6, radius: 13, armour: 0 },
  shade: { name: 'Greater Shade', hp: 420, speed: 40, reward: 24, leak: 2, shadeHeal: 10, radius: 19, armour: 0 },
  colossus: { name: 'Gloom Colossus', hp: 1500, speed: 20, reward: 60, leak: 5, shadeHeal: 16, radius: 26, armour: 0.15 },
  dreadnought: { name: 'Dreadnought Shade', hp: 2600, speed: 17, reward: 90, leak: 4, shadeHeal: 12, radius: 30, armour: 0.45 },
  eclipse: { name: 'THE ECLIPSE', hp: 5200, speed: 15, reward: 400, leak: 20, shadeHeal: 0, radius: 40, armour: 0 },
};

/** Starting resources on a fresh campaign. */
export const START = { gold: 200, lives: 20 };

/** Extra starting gold granted when a run begins on a later island. */
export function islandStartGold(islandIndex) {
  return START.gold + islandIndex * 170;
}

/** Gold paid for clearing a wave, before interest and bonuses. */
export function waveClearGold(wave) {
  return 24 + Math.floor(wave * 1.6);
}

/** Interest on unspent gold at wave end, capped so hoarding has a ceiling. */
export function interestOn(gold) {
  return Math.min(26, Math.floor(gold * 0.06));
}

/** Enemy health multiplier for a wave number (campaign and endless alike). */
export function waveHpScale(wave) {
  return 1 + (wave - 1) * 0.155 + Math.pow(Math.max(0, wave - 24), 2) * 0.0035;
}

/** Enemy speed multiplier: gentle, so fast builds stay readable. */
export function waveSpeedScale(wave) {
  return 1 + Math.min(0.35, (wave - 1) * 0.0055);
}

/**
 * Art direction per island. The renderer lerps the sky by the sun's arc
 * and tints everything else from these anchors, so each island reads as
 * its own place at a glance. `biome` selects the terrain painter and the
 * dressing vocabulary; `clouds` is the island's baseline weather.
 */
export const ISLAND_ART = [
  {
    name: 'Dawn Coast', biome: 'coast', clouds: 2,
    skyTop: '#2e4a7d', skyMid: '#c96f4a', skyLow: '#f7c873',
    sea: '#274b63', shore: '#7d9db5', ground: '#5d7a4a', groundDark: '#48603a', groundLight: '#7ba361',
    path: '#3a3230', pathEdge: '#57493e', accent: '#ffd98a', rock: '#6b6f7a',
    flowerA: '#ff9ec4', flowerB: '#fff3f6', tuft: '#3f5a33',
  },
  {
    name: 'Noon Desert', biome: 'desert', clouds: 1,
    skyTop: '#3a6ea8', skyMid: '#7fb0d8', skyLow: '#ffe9a8',
    sea: '#b98f45', shore: '#d9b96a', ground: '#c9a45c', groundDark: '#a9853f', groundLight: '#e6c87e',
    path: '#5a4632', pathEdge: '#7a5f42', accent: '#fff0b0', rock: '#8a6f4d',
    flowerA: '#e86a5a', flowerB: '#ffd98a', tuft: '#8a6f3a',
  },
  {
    name: 'Dusk Cliffs', biome: 'cliffs', clouds: 2,
    skyTop: '#241f4e', skyMid: '#7a3a6e', skyLow: '#e88a5a',
    sea: '#2c2440', shore: '#4a4066', ground: '#4a4458', groundDark: '#383344', groundLight: '#5f5872',
    path: '#241f28', pathEdge: '#453a4e', accent: '#ffb37a', rock: '#5d5878',
    flowerA: '#c9a0ff', flowerB: '#ffb37a', tuft: '#3a4450',
  },
  {
    name: 'Ember Shoals', biome: 'shoals', clouds: 2,
    skyTop: '#33161f', skyMid: '#8a3324', skyLow: '#ff9a4e',
    sea: '#571f14', shore: '#8a3a22', ground: '#3d3230', groundDark: '#2b2321', groundLight: '#54443e',
    path: '#191314', pathEdge: '#33272a', accent: '#ffb37a', rock: '#5a4a44',
    flowerA: '#ff7a3c', flowerB: '#ffc93c', tuft: '#4a3430',
  },
  {
    name: 'Frostmere', biome: 'frost', clouds: 3,
    skyTop: '#33507a', skyMid: '#7fa8c9', skyLow: '#dceef7',
    sea: '#5d84a6', shore: '#a8c8dd', ground: '#aebfd0', groundDark: '#8ba3ba', groundLight: '#d7e6f0',
    path: '#4a4238', pathEdge: '#6b5f4c', accent: '#bfe8ff', rock: '#71879c',
    flowerA: '#bfe8ff', flowerB: '#ffffff', tuft: '#5d7a8a',
  },
];

/** Night art: any island under the moon, cooled and darkened. */
export const NIGHT_ART = {
  skyTop: '#060a1e', skyMid: '#101c3f', skyLow: '#274069',
  ground: '#232c3d', groundDark: '#1a2231', groundLight: '#2e3a4f',
  path: '#12100f', pathEdge: '#2c2c38', accent: '#bcd3ff', rock: '#39415a',
};

/** The spectrum-upgrade branches offered between waves. */
export const SPECTRUM_TREE = [
  { id: 'emberPlus', branch: 'Ember', name: 'Kindled Glass', text: 'Ember beams burn +35%.', max: 3 },
  { id: 'gildedPlus', branch: 'Gilded', name: 'Solar Mint', text: 'Gilded beams deal +35% damage.', max: 3 },
  { id: 'umbralPlus', branch: 'Umbral', name: 'Deep Violet', text: 'Umbral slow is +12% stronger.', max: 3 },
  { id: 'chronoPlus', branch: 'Chrono', name: 'Stilled Hour', text: 'Chrono slow is +10% stronger and lasts longer.', max: 3 },
  { id: 'stormPlus', branch: 'Storm', name: 'Faraday Crown', text: 'Chain lightning strikes +40% harder, +1 arc.', max: 3 },
  { id: 'longerLight', branch: 'Optics', name: 'Polished Path', text: 'The beam travels 12% farther.', max: 3 },
  { id: 'wideBeam', branch: 'Optics', name: 'Broad Aperture', text: 'The beam is 20% wider.', max: 2 },
  { id: 'richKills', branch: 'Bounty', name: 'Ashen Tithe', text: 'Shades drop +15% gold.', max: 3 },
  { id: 'crystalWard', branch: 'Heart', name: 'Crystal Ward', text: 'Restore 2 lives, +1 max life.', max: 5 },
  { id: 'swiftHands', branch: 'Craft', name: 'Quicksilver Hands', text: 'Towers cost 8% less to build.', max: 2 },
];

/** One-line weather forecast per island, shown on the campaign map. */
export const ISLAND_WEATHER = [
  'Sea breeze: a few slow clouds.',
  'Dry air: the sun is almost never covered.',
  'Dusk winds: clouds cross the spiral.',
  'Ash weather: dark clouds drink the beam.',
  'Snow squalls: thick, slow, beam-eating cloud.',
];
