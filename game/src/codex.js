// The Codex of Glass and Shade: the game's own field guide.
//
// Every tower, every shade, and the arts that govern them — the beam,
// the spectrum, weather, ice — written down in one place the player can
// open from the title, the pause, or the campaign map (key C). Entries
// carry their true numbers, drawn from the same tables the simulation
// uses, so the codex never lies about the game it describes. Shades the
// player has not yet met are listed as silhouettes with their unlock
// wave; meeting one in a run is not required to read about it — the
// codex is a kindness, not a gate.

import { FIELD, TOWERS, ENEMIES } from './config.js';
import { roundRect, registerButton } from './render.js';

/** Longer writing for each tower, keyed by kind. */
const TOWER_LORE = {
  mirror: 'The first glass anyone learns, and the last anyone masters. A mirror does nothing but tell the truth at an angle — and the whole defence is that truth, told forty times a wave. Rotate it with Q / E or the wheel; a degree either way is a different battle.',
  prism: 'Sunlight looks simple until a prism shows its workings: ember to burn, gilded to wound, umbral to hold. The fan is fixed at thirty degrees a side, so where a prism stands decides which roads each colour can ever reach.',
  lens: 'A lens does not split or steer — it concentrates. A beam that passes through leaves at nearly twice the strength and travels farther, but each lens will only focus a given beam once. Chain two and the light arrives angry.',
  splitter: 'A Y of glass that forks a beam into two children at three-fifths strength. Forks multiply coverage, not power: a splitter is how one sun defends two roads, and how a careless player defends neither.',
  bell: 'The Dawn Bell is not glass at all, but it rings in the light\'s key. Every eighteen seconds its peal rolls across the whole island: every shade on the road slows and shivers. It needs no beam and aims at nothing — it is the defence\'s heartbeat.',
  shard: 'A splinter of the Eclipse itself, bottled. It drinks the beam that crosses it and, when full, fires everything back as a single piercing lance through the thickest knot of shades. Expensive, hungry, and worth both.',
  chrono: 'Ground from the sand of an hourglass that ran backwards. Light through a Chrono Lens does not burn hotter — it arrives earlier, and the shades it touches move as if through deep water. Sunlight and moonlight become chrono light outright; coloured beams carry the stilling with them.',
  storm: 'A prism struck by lightning and never quite recovered. It fans sunlight five ways — the full spectrum plus two raw strands thrown wide — and every few seconds calls a bolt down on whatever the light is holding. No beam, no storm: it is glass first and weather second.',
};

/** First wave each shade kind can appear (boss kinds noted). */
const SHADE_FIRST = {
  moth: 'Wave 1', crawler: 'Wave 2', wraith: 'Wave 4', swift: 'Wave 5, at night',
  splitterbug: 'Wave 8', beetle: 'Wave 9', eclipse: 'Every 10th wave',
  burrower: 'Wave 14', veil: 'Wave 17', shade: 'Wave 22', colossus: 'Wave 27',
  dreadnought: 'Wave 34',
};

/** One-line role for each shade kind. */
const SHADE_ROLES = {
  moth: 'The basic dark. Slow, soft, and everywhere.',
  crawler: 'Armoured segments; the road\'s steady pressure.',
  wraith: 'Pale and quick, and quicker still at night.',
  swift: 'A dart of shadow. Blink and it is at the crystal.',
  splitterbug: 'Dies in two places at once — it splits into moths.',
  beetle: 'A dome of chitin. Burns slowly, arrives eventually.',
  burrower: 'Travels underground, where no light can reach it.',
  veil: 'Weaves a veil of shade that sheds most of every beam.',
  shade: 'The dark, standing up. Tall, patient, hard to kill.',
  colossus: 'A walking hill. The road bends around it.',
  dreadnought: 'Plated in woven shade; splits into Greater Shades when slain.',
  eclipse: 'The boss of the dark. Its shadow drinks the beam whole.',
};

/** Longer writing for each shade, keyed by kind. */
const SHADE_LORE = {
  moth: 'Duskmoths are what darkness becomes when it wants to travel: soot with wings. Alone they are nothing. The dark has never once sent one alone.',
  crawler: 'Gloomcrawlers wear their grandmothers as armour, segment over segment. Ember loves them — a crawler under a burning beam is a fuse walking toward the crystal.',
  wraith: 'Pale Wraiths are the dark\'s memory of drowned sailors. By day they merely hurry. By night, in shadow, they surge — the moonbeam\'s deep slow exists because of them.',
  swift: 'Nightswifts are barely creatures at all: a direction with an appetite. They outrun every beam\'s re-aiming. The answer is never to chase them, but to have the light already standing where they must go.',
  splitterbug: 'The Mitosis Husk is two moths in a trench coat of shade, and killing it proves the point. Aim wide, or aim twice.',
  beetle: 'Umbral Beetles knit themselves back together in shadow faster than most beams can unpick them by day. Hold the light on them, or hold them still with umbral and chrono while the gilded works.',
  burrower: 'Deepburrowers surface for three seconds and dive for two and a half, and underground there is no light at all — no burn, no slow, nothing. They are why the Dawn Bell earns its gold: its peal reaches even under the road.',
  veil: 'A Veilspinner wraps itself in woven shade that sheds most of every beam while it lasts. The veil comes and goes on its own clock; patient glass simply out-waits it, and burn stacks keep working underneath.',
  shade: 'Greater Shades are the dark in its Sunday shape: tall, unhurried, and very hard to unmake. When one reaches the crystal it costs two lives, and it knows it.',
  colossus: 'A Gloom Colossus is not so much a creature as a landslide with intent. Five lives if it arrives. Everything the defence owns should already be pointing at it.',
  dreadnought: 'The Dreadnought Shade is the dark\'s answer to the Storm Prism: plate over plate of woven shade that turns aside nearly half of all light. Slow it with chrono, burn it with ember, and do not celebrate when it falls — two Greater Shades climb out of the wreck.',
  eclipse: 'THE ECLIPSE is the dark\'s king and its argument: a crowned void that drags a disc of perfect shadow around itself, swallowing any beam that tries to cross. Route the light around the disc, kill the honour guard first, and remember — it cannot heal. Every point of damage is forever.',
};

/** Codex entries for the eight towers, in build-bar order. */
export const CODEX_TOWERS = Object.entries(TOWERS).map(([kind, spec]) => ({
  kind,
  name: spec.name,
  role: spec.blurb,
  stats: [
    ['Cost', `${spec.cost} gold`],
    ['Footprint', `${spec.radius} px`],
    ['Hotkey', spec.key],
  ],
  lore: TOWER_LORE[kind],
}));

/** Codex entries for the twelve shades, in the order they are met. */
export const CODEX_SHADES = [
  'moth', 'crawler', 'wraith', 'swift', 'splitterbug', 'beetle',
  'burrower', 'veil', 'shade', 'colossus', 'dreadnought', 'eclipse',
].map((kind) => {
  const spec = ENEMIES[kind];
  return {
    kind,
    name: spec.name,
    role: SHADE_ROLES[kind],
    stats: [
      ['First seen', SHADE_FIRST[kind]],
      ['Health', `${spec.hp}`],
      ['Speed', `${spec.speed}`],
      ['Bounty', `${spec.reward} gold`],
      ['Cost to the crystal', `${spec.leak} ${spec.leak === 1 ? 'life' : 'lives'}`],
    ],
    lore: SHADE_LORE[kind],
  };
});

/** The arts: mechanics entries, written as the game's own doctrine. */
export const CODEX_ARTS = [
  {
    kind: 'beam', name: 'The Beam',
    role: 'One sun, one beam, sixty decisions a second.',
    stats: [['Source', 'The sun (or moon)'], ['Travels', '3,600 px'], ['Events', '34 reflections, fans and forks']],
    lore: 'The beam enters from the sun and travels until it is spent, swallowed by shadow, or leaves the island. It never forks on its own and never turns a corner: every change of direction is a piece of glass the player placed and aimed. As the sun crosses the sky during a wave, the entry angle swings with it — a defence built at dawn is wrong by noon, which is the game.',
  },
  {
    kind: 'spectrum', name: 'The Spectrum',
    role: 'White light is a promise; colour is the keeping of it.',
    stats: [['Ember', 'Burn over time'], ['Gilded', 'Raw damage'], ['Umbral', 'Slow'], ['Chrono', 'Deep slow'], ['Moon', 'Weak burn, long slow']],
    lore: 'Raw sunlight wounds everything a little. Colour is how the defence specialises: ember sets burning stacks that keep working after the beam moves on, gilded simply hits hardest, umbral and chrono hold shades in the light longer, and moonlight trades damage for the deepest slow of all. Between waves, blessings deepen one branch at a time.',
  },
  {
    kind: 'shadow', name: 'The Shadow Bargain',
    role: 'What the light does not touch, the dark repairs.',
    stats: [['By day', 'Unlit shades heal'], ['By night', 'Unlit shades surge +25%'], ['Under cloud', 'Healing is faster still']],
    lore: 'A shade standing in light burns. A shade standing anywhere else is being mended by the dark itself — by day it heals, by night it hurries. Total coverage is impossible; the art is choosing which stretches of road are allowed to be shadow, and for how long.',
  },
  {
    kind: 'weather', name: 'Weather',
    role: 'Clouds are the Eclipse\'s poor relations: slower, commoner, everywhere.',
    stats: [['Effect on beam', 'Swallowed at the shadow\'s edge'], ['Effect on sun', 'Cover dims the beam at its source'], ['Answer', 'Mirrors — light already bent around a shadow keeps burning']],
    lore: 'Every island has its own sky, from the desert\'s near-empty blue to Frostmere\'s beam-eating squalls. A cloud\'s shadow on the ground works exactly like the Eclipse\'s disc. Watch the sun dial: when a cloud crosses the sun itself, every beam on the field starves at once, and the only defence is patience and position.',
  },
  {
    kind: 'ice', name: 'Ice and Open Water',
    role: 'Frostmere\'s road is a frozen lake, and the lake is a weapon — for whoever holds the beam.',
    stats: [['Unbroken ice', 'Shades move +45%'], ['Melting', 'Hold any beam on a sheet'], ['Open water', 'Shades move −22%']],
    lore: 'Three of Frostmere\'s sheets lie across the road and the fourth guards the crystal. On unbroken ice the shades skate; melt a sheet with steady light and the same water drags at their feet for the rest of the run. Melting is permanent and cumulative — early waves on Frostmere are an investment, and Thawbringers are made there.',
  },
  {
    kind: 'crystal', name: 'The Heart Crystal',
    role: 'Twenty lives, one per cent of the island\'s heart.',
    stats: [['Lives', '20'], ['Restored by', 'Crystal Ward blessings'], ['Lost to', 'Every shade that arrives']],
    lore: 'The crystal is what the dark is walking toward, on every island, on every wave. It does not fight back. When the last life goes, the light goes out — but the campaign remembers how far the defence got, and the road stays open for another try.',
  },
];

/** Tabs across the top of the codex. */
const TABS = [
  { id: 'towers', label: 'Towers of Glass' },
  { id: 'shades', label: 'Shades' },
  { id: 'arts', label: 'The Arts' },
];

/** Entries for a tab id. */
function entriesFor(tab) {
  if (tab === 'towers') return CODEX_TOWERS;
  if (tab === 'shades') return CODEX_SHADES;
  return CODEX_ARTS;
}

/**
 * Draw the codex over whatever screen summoned it. The world's codex
 * state is {tab, sel}; clicks register regions for the screens module
 * to dispatch ('codexTab', 'codexEntry', 'codexClose').
 */
export function drawCodex(ctx, world, input) {
  const state = world.codex;
  if (!state) return;
  ctx.fillStyle = 'rgba(5,4,10,0.88)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const panel = { x: 90, y: 64, w: FIELD.width - 180, h: FIELD.height - 128 };
  ctx.fillStyle = 'rgba(24,20,38,0.98)';
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,217,138,0.5)';
  ctx.lineWidth = 1.6;
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 16);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 30px Georgia, serif';
  ctx.fillText('The Codex of Glass and Shade', panel.x + 34, panel.y + 46);
  registerButton(ctx, world, panel.x + panel.w - 118, panel.y + 22, 84, 34, 'Close ✕', 'codexClose', input, false);

  // Tabs.
  let tx = panel.x + 34;
  for (const tab of TABS) {
    const active = state.tab === tab.id;
    const w = 168;
    ctx.fillStyle = active ? 'rgba(255,201,60,0.9)' : 'rgba(44,40,64,0.95)';
    roundRect(ctx, tx, panel.y + 66, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = active ? '#241a08' : '#f4ecd8';
    ctx.font = '700 13.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tab.label, tx + w / 2, panel.y + 84);
    ctx.textAlign = 'left';
    world.uiRegions.push({ x: tx, y: panel.y + 66, w, h: 34, action: 'codexTab', data: tab.id });
    tx += w + 12;
  }

  // Entry list on the left.
  const entries = entriesFor(state.tab);
  const listX = panel.x + 34;
  const listY = panel.y + 122;
  const rowH = 34;
  entries.forEach((entry, i) => {
    const y = listY + i * rowH;
    const selected = state.sel === i;
    ctx.fillStyle = selected ? 'rgba(255,201,60,0.22)' : 'rgba(255,255,255,0.03)';
    roundRect(ctx, listX, y, 252, rowH - 5, 7);
    ctx.fill();
    ctx.fillStyle = selected ? '#ffe9a8' : 'rgba(244,236,216,0.85)';
    ctx.font = `${selected ? '700' : '600'} 13.5px system-ui, sans-serif`;
    ctx.fillText(entry.name, listX + 12, y + (rowH - 5) / 2 + 1);
    world.uiRegions.push({ x: listX, y, w: 252, h: rowH - 5, action: 'codexEntry', data: i });
  });

  // The open entry on the right.
  const entry = entries[Math.min(state.sel, entries.length - 1)];
  const dx = listX + 282;
  const dw = panel.w - 282 - 34;
  ctx.fillStyle = '#fff6d8';
  ctx.font = '700 26px Georgia, serif';
  ctx.fillText(entry.name, dx, listY + 16);
  ctx.fillStyle = '#ffd94e';
  ctx.font = 'italic 15px Georgia, serif';
  wrapText(ctx, entry.role, dx, listY + 44, dw, 20);
  let sy = listY + 84;
  for (const [label, value] of entry.stats) {
    ctx.fillStyle = 'rgba(244,236,216,0.55)';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), dx, sy);
    ctx.fillStyle = '#f4ecd8';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(value, dx + 150, sy);
    sy += 24;
  }
  ctx.fillStyle = 'rgba(244,236,216,0.92)';
  ctx.font = '15px system-ui, sans-serif';
  wrapText(ctx, entry.lore, dx, sy + 22, dw, 23);
}

/** Draw text wrapped at `width`, one line per `lineHeight`; returns lines used. */
export function wrapText(ctx, text, x, y, width, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > width && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines += 1;
    } else {
      line = trial;
    }
  }
  if (line) {
    ctx.fillText(line, x, y + lines * lineHeight);
    lines += 1;
  }
  return lines;
}
