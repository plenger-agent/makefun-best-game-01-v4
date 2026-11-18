// Screens and input dispatch: title, campaign, codex, blessings, endings.
//
// The renderer draws the world; this module draws what sits above it —
// the title screen with its instructions, the between-wave blessing
// cards, the pause veil, and the game-over and victory panels — routes
// clicks to the campaign map and the codex (drawn by their own
// modules), and owns every key. One place for the interface rules: what
// a click means never depends on which module drew the button.

import { FIELD, TOWERS } from './config.js';
import { roundRect, registerButton } from './render.js';
import { drawCodex } from './codex.js';
import { buildTower, upgradeTower, sellTower, rotateTower, buildCost } from './towers.js';
import { startRun, startRunAt, callWave, takeOffer, enterEndless, openCampaign, toggleCodex, celebrate } from './world.js';
import { storeSave, highestUnlocked } from './save.js';
import { ACHIEVEMENTS } from './achievements.js';
import { distance } from './geometry.js';

/** Draw whichever overlay the world's screen calls for. */
export function drawScreens(ctx, world, input) {
  if (world.screen === 'title') drawTitle(ctx, world, input);
  if (world.screen === 'over') drawEndPanel(ctx, world, input, false);
  if (world.screen === 'victory') drawEndPanel(ctx, world, input, true);
  if (world.screen === 'play' && world.offer && !world.paused) drawOffer(ctx, world, input);
  if (world.paused && world.screen === 'play') drawPause(ctx, world, input);
  if (world.codex) drawCodex(ctx, world, input);
}

/** The title screen: name, premise, controls, records, and the ways in. */
function drawTitle(ctx, world, input) {
  veil(ctx, 0.45);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 74px Georgia, serif';
  ctx.shadowColor = 'rgba(255,170,60,0.65)';
  ctx.shadowBlur = 34;
  ctx.fillText('HELIODROME', FIELD.width / 2, 200);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff6d8';
  ctx.font = 'italic 25px Georgia, serif';
  ctx.fillText('Bend the Noon', FIELD.width / 2, 240);

  ctx.fillStyle = 'rgba(244,236,216,0.92)';
  ctx.font = '16.5px system-ui, sans-serif';
  ctx.fillText('One beam of sunlight enters your island. The shades are coming for the Heart Crystal.', FIELD.width / 2, 292);
  ctx.fillText('Place mirrors and prisms of glass to steer the light across the road —', FIELD.width / 2, 318);
  ctx.fillText('they burn in the light, and heal in the shadow it leaves behind.', FIELD.width / 2, 344);

  const lines = [
    ['Build', 'Click a tower card (keys 1–8), then a stone pad. Eight kinds of glass, one sun.'],
    ['Aim', 'Click a mirror, then Q / E or the mouse wheel to rotate it. Prisms split the beam into colours.'],
    ['Survive', '60 waves, 5 islands, a boss — THE ECLIPSE — every 10th wave. Night waves invert the rules.'],
    ['Endure', 'Clouds eat the beam. Ice speeds the shades until you melt it. The Dreadnought splits when it falls.'],
    ['Grow', 'After each wave, choose a spectrum blessing. The sun keeps moving: keep re-bending the light.'],
  ];
  ctx.textAlign = 'left';
  let y = 392;
  for (const [head, body] of lines) {
    ctx.fillStyle = '#ffd94e';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(head, 300, y);
    ctx.fillStyle = 'rgba(244,236,216,0.9)';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(body, 372, y);
    y += 29;
  }
  ctx.textAlign = 'center';

  const save = world.save;
  if (save && (save.bestWave > 0 || save.victories > 0 || save.achievements.length > 0)) {
    const stars = save.islands.reduce((sum, r) => sum + r.stars, 0);
    ctx.fillStyle = 'rgba(201,184,255,0.9)';
    ctx.font = '13.5px system-ui, sans-serif';
    ctx.fillText(
      `Your records: best wave ${save.bestWave} · best score ${save.bestScore} · victories ${save.victories} · campaign stars ${stars}/15 · achievements ${save.achievements.length}/${ACHIEVEMENTS.length}`,
      FIELD.width / 2, y + 14,
    );
  }

  registerButton(ctx, world, FIELD.width / 2 - 140, 566, 280, 56, '☀  Begin the Defence', 'start', input, true);
  registerButton(ctx, world, FIELD.width / 2 - 320, 634, 200, 44, '🗺  Campaign Map', 'campaign', input, false);
  registerButton(ctx, world, FIELD.width / 2 + 120, 634, 200, 44, '📖  Codex (C)', 'codex', input, false);
  ctx.fillStyle = 'rgba(244,236,216,0.55)';
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.fillText('Mouse and keyboard · Space calls the next wave · P pauses · C codex · M mutes', FIELD.width / 2, 706);
  ctx.textAlign = 'left';
}

/** Between-wave blessing cards: three spectrum choices, one free pick. */
function drawOffer(ctx, world, input) {
  const offer = world.offer;
  if (!offer.length) return;
  const w = 300;
  const h = 148;
  const gap = 26;
  const total = offer.length * w + (offer.length - 1) * gap;
  let x = (FIELD.width - total) / 2;
  const y = 470;
  ctx.fillStyle = 'rgba(8,6,14,0.5)';
  ctx.fillRect(0, y - 42, FIELD.width, h + 96);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 19px Georgia, serif';
  ctx.fillText('The light settles. Choose a blessing:', FIELD.width / 2, y - 14);
  for (const entry of offer) {
    const hover = input.mouse.x >= x && input.mouse.x <= x + w && input.mouse.y >= y && input.mouse.y <= y + h;
    ctx.fillStyle = hover ? 'rgba(64,52,92,0.97)' : 'rgba(34,30,52,0.97)';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = branchColour(entry.branch);
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    ctx.fillStyle = branchColour(entry.branch);
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(entry.branch.toUpperCase(), x + w / 2, y + 26);
    ctx.fillStyle = '#fff6d8';
    ctx.font = '700 19px Georgia, serif';
    ctx.fillText(entry.name, x + w / 2, y + 56);
    ctx.fillStyle = 'rgba(244,236,216,0.88)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(entry.text, x + w / 2, y + 86);
    ctx.fillStyle = 'rgba(201,184,255,0.9)';
    ctx.font = '12.5px system-ui, sans-serif';
    ctx.fillText(`Level ${world.tree[entry.id]} of ${entry.max}`, x + w / 2, y + 118);
    world.uiRegions.push({ x, y, w, h, action: 'offer', data: entry });
    x += w + gap;
  }
  ctx.textAlign = 'left';
}

/** Card edge colour per spectrum branch. */
function branchColour(branch) {
  switch (branch) {
    case 'Ember': return '#ff7a3c';
    case 'Gilded': return '#ffc93c';
    case 'Umbral': return '#9a6bff';
    case 'Chrono': return '#67e8f9';
    case 'Storm': return '#7fb0ff';
    case 'Heart': return '#ff8fb5';
    default: return '#7fd4ff';
  }
}

/** The pause veil. */
function drawPause(ctx, world, input) {
  veil(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 44px Georgia, serif';
  ctx.fillText('The Noon Holds Its Breath', FIELD.width / 2, 318);
  ctx.fillStyle = 'rgba(244,236,216,0.85)';
  ctx.font = '15.5px system-ui, sans-serif';
  ctx.fillText('Mirrors keep their angles. The shades keep their hunger.', FIELD.width / 2, 360);
  registerButton(ctx, world, FIELD.width / 2 - 290, 410, 176, 48, 'Resume', 'pause', input, true);
  registerButton(ctx, world, FIELD.width / 2 - 88, 410, 176, 48, '📖  Codex', 'codex', input, false);
  registerButton(ctx, world, FIELD.width / 2 + 114, 410, 176, 48, 'Restart Run', 'restart', input, false);
  ctx.textAlign = 'left';
}

/** Game over and victory share a panel: result, tallies, ways onward. */
function drawEndPanel(ctx, world, input, victory) {
  veil(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = victory ? '#ffe9a8' : '#ff9a8f';
  ctx.font = '700 52px Georgia, serif';
  ctx.fillText(victory ? 'THE CRYSTAL HOLDS' : 'THE LIGHT GOES OUT', FIELD.width / 2, 238);
  ctx.fillStyle = 'rgba(244,236,216,0.92)';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(
    victory
      ? 'Sixty waves broke against your glass, and the Long Noon is yours.'
      : `The shades reached the Heart Crystal on wave ${world.wave}.`,
    FIELD.width / 2, 282,
  );
  const stars = world.save ? world.save.islands.reduce((sum, r) => sum + r.stars, 0) : 0;
  const rows = [
    ['Waves survived', `${victory ? 60 : Math.max(0, world.wave - (world.director.phase === 'build' ? 1 : 0))}`],
    ['Shades burned', `${world.stats.kills}`],
    ['Bosses broken', `${world.stats.bossesBroken}`],
    ['Gold earned', `${world.stats.earned}`],
    ['Campaign stars', `${stars} / 15`],
    ['Achievements', `${world.achievements.size} / ${ACHIEVEMENTS.length}`],
    ['Final score', `${world.score}`],
  ];
  let y = 330;
  ctx.font = '15.5px system-ui, sans-serif';
  for (const [label, value] of rows) {
    ctx.fillStyle = 'rgba(244,236,216,0.65)';
    ctx.textAlign = 'right';
    ctx.fillText(label, FIELD.width / 2 - 16, y);
    ctx.fillStyle = '#fff6d8';
    ctx.textAlign = 'left';
    ctx.fillText(value, FIELD.width / 2 + 16, y);
    y += 27;
  }
  ctx.textAlign = 'center';
  if (victory) {
    registerButton(ctx, world, FIELD.width / 2 - 310, 540, 190, 52, 'Endless Noon ∞', 'endless', input, true);
    registerButton(ctx, world, FIELD.width / 2 - 100, 540, 190, 52, 'New Run', 'restart', input, false);
    registerButton(ctx, world, FIELD.width / 2 + 110, 540, 190, 52, 'Campaign Map', 'campaign', input, false);
  } else {
    registerButton(ctx, world, FIELD.width / 2 - 210, 540, 200, 52, 'Try Again', 'restart', input, true);
    registerButton(ctx, world, FIELD.width / 2 + 10, 540, 200, 52, 'Campaign Map', 'campaign', input, false);
  }
  ctx.textAlign = 'left';
}

/** A translucent dark veil over the scene. */
function veil(ctx, alpha) {
  ctx.fillStyle = `rgba(6,5,12,${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** Dispatch a click at logical (x, y). Returns true when it was consumed. */
export function handleClick(world, x, y) {
  world.audio?.unlock();
  // Regions were registered back-to-front; the last drawn is on top.
  for (let i = world.uiRegions.length - 1; i >= 0; i -= 1) {
    const region = world.uiRegions[i];
    if (x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h) {
      // While the codex is open it owns every click it can see.
      if (world.codex && !region.action.startsWith('codex')) continue;
      runAction(world, region.action, region.data);
      return true;
    }
  }
  if (world.codex) return true; // The codex swallows stray clicks.
  if (world.screen !== 'play' || world.paused) return false;

  // Field clicks: build on a pad, or select standing glass.
  for (const pad of world.island.pads) {
    if (distance({ x, y }, pad) < 24) {
      if (pad.tower) {
        world.selected = pad.tower;
        world.buildKind = null;
        world.audio?.click();
        return true;
      }
      if (world.buildKind) {
        const tower = buildTower(world, world.buildKind, pad);
        if (tower) {
          world.selected = tower;
          celebrate(world);
          if (tower.kind !== 'mirror' && tower.kind !== 'shard') world.buildKind = world.gold >= buildCost(world, tower.kind) ? world.buildKind : null;
        } else {
          world.audio?.error();
        }
        return true;
      }
      return true;
    }
  }
  for (const tower of world.towers) {
    if (distance({ x, y }, tower) < tower.radius + 7) {
      world.selected = tower;
      world.buildKind = null;
      world.audio?.click();
      return true;
    }
  }
  world.selected = null;
  return false;
}

/** Run one UI action by name. */
function runAction(world, action, data) {
  switch (action) {
    case 'start':
      startRun(world);
      break;
    case 'restart':
      startRunAt(world, world.endless ? 0 : Math.min(world.islandIndex, highestUnlocked(world.save || { islands: [] })));
      break;
    case 'endless':
      enterEndless(world);
      break;
    case 'campaign':
      openCampaign(world);
      break;
    case 'campaignClose':
      world.screen = 'title';
      world.audio?.click();
      break;
    case 'campaignSelect':
      world.campaignSel = data;
      world.audio?.click();
      break;
    case 'campaignStart':
      startRunAt(world, data);
      break;
    case 'codex':
      toggleCodex(world, true);
      break;
    case 'codexClose':
      toggleCodex(world, false);
      break;
    case 'codexTab':
      if (world.codex) {
        world.codex.tab = data;
        world.codex.sel = 0;
      }
      world.audio?.click();
      break;
    case 'codexEntry':
      if (world.codex) world.codex.sel = data;
      world.audio?.click();
      break;
    case 'pause':
      world.paused = !world.paused;
      world.audio?.click();
      break;
    case 'speed':
      world.speed = world.speed === 1 ? 2 : world.speed === 2 ? 3 : 1;
      if (world.save) {
        world.save.speed = world.speed;
        storeSave(world.save);
      }
      break;
    case 'mute':
      if (world.audio) {
        world.audio.toggleMute();
        if (world.save) {
          world.save.muted = world.audio.muted;
          storeSave(world.save);
        }
      }
      break;
    case 'buildKind':
      world.buildKind = world.buildKind === data ? null : data;
      world.selected = null;
      world.audio?.click();
      break;
    case 'callWave':
      callWave(world);
      break;
    case 'upgrade':
      if (world.selected) upgradeTower(world, world.selected);
      break;
    case 'sell':
      if (world.selected) sellTower(world, world.selected);
      break;
    case 'offer':
      takeOffer(world, data);
      break;
    default:
      break;
  }
}

/** Handle one key press (lowercase key name) for the current screen. */
export function handleKey(world, key) {
  world.audio?.unlock();
  if (key === 'm') {
    runAction(world, 'mute');
    return;
  }
  if (world.codex) {
    if (key === 'escape' || key === 'c') toggleCodex(world, false);
    return;
  }
  if (key === 'c' && world.screen !== 'campaign') {
    toggleCodex(world, true);
    return;
  }
  if (world.screen === 'campaign') {
    if (key === 'escape' || key === 'enter') world.screen = 'title';
    return;
  }
  if (world.screen === 'title') {
    if (key === ' ' || key === 'enter') startRun(world);
    return;
  }
  if (world.screen === 'over' || world.screen === 'victory') {
    if (key === ' ' || key === 'enter' || key === 'r') startRun(world);
    return;
  }
  switch (key) {
    case 'p':
    case 'escape':
      if (world.selected && key === 'escape') world.selected = null;
      else world.paused = !world.paused;
      break;
    case ' ':
      if (!world.paused && !world.offer) callWave(world);
      break;
    case 'q':
      if (world.selected) { rotateTower(world.selected, -Math.PI / 36); world.audio?.rotate(); }
      break;
    case 'e':
      if (world.selected) { rotateTower(world.selected, Math.PI / 36); world.audio?.rotate(); }
      break;
    case 'u':
      if (world.selected) upgradeTower(world, world.selected);
      break;
    case 'x':
      if (world.selected) sellTower(world, world.selected);
      break;
    default: {
      const kind = Object.keys(TOWERS).find((k) => TOWERS[k].key === key);
      if (kind) {
        world.buildKind = world.buildKind === kind ? null : kind;
        world.selected = null;
        world.audio?.click();
      }
      break;
    }
  }
}

/** Per-frame held-key and wheel aiming for the selected tower. */
export function applyAimKeys(world, input, frame) {
  const tower = world.selected;
  if (!tower || world.screen !== 'play') return;
  if (tower.kind !== 'mirror' && tower.kind !== 'shard') return;
  if (input.held('q')) rotateTower(tower, -0.028);
  if (input.held('e')) rotateTower(tower, 0.028);
  if (frame.wheel) {
    rotateTower(tower, frame.wheel * (Math.PI / 30));
    world.audio?.rotate();
  }
}
