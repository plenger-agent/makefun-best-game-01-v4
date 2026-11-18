// The optics: tracing the sunbeam through the player's glass.
//
// One beam of sunlight enters from the sun — dimmed by whatever cloud
// covers it — and what it becomes is decided here, sixty times a
// second: mirrors reflect it, prisms fan it into the spectrum, lenses
// focus it, splitters fork it, chrono lenses bend it into time, storm
// prisms fan it five ways, eclipse shards drink it, and shadow — the
// Eclipse's disc, or a cloud's — swallows it whole. The tracer walks a
// stack of beam states; each state is one straight run of light with a
// colour, a power, a remaining length budget, and a memory of the
// lenses it has already passed (a lens focuses a beam only once).
//
// The tracer is pure geometry — it reads the world's towers, sun and
// sky and returns segments. Damage is applied separately in
// applyBeamDamage, so the renderer can draw exactly the segments that
// hurt. Ice melts separately too, in meltIce, from the same segments.

import { SPECTRUM, BEAM_MAX_LENGTH, BEAM_MAX_EVENTS, BEAM_RADIUS, FIELD } from './config.js';
import { rayCircle, raySegment, reflect, rotate, closestOnSegment, fromAngle } from './geometry.js';
import { sunPowerScale } from './weather.js';

/** A fresh beam state leaving the sun (or a splitting tower). */
function beamState(origin, dir, colour, power, budget, lenses, chrono) {
  return { origin, dir, colour, power, budget, lenses: lenses || new Set(), chrono: chrono || new Set() };
}

/** The mirror's reflective face: a segment through its centre at its angle. */
function mirrorFace(tower) {
  const along = fromAngle(tower.angle);
  return {
    a: { x: tower.x - along.x * tower.radius, y: tower.y - along.y * tower.radius },
    b: { x: tower.x + along.x * tower.radius, y: tower.y + along.y * tower.radius },
    normal: { x: -along.y, y: along.x },
  };
}

/** Distance at which the ray leaves the field rectangle, or Infinity. */
function rayExitField(origin, dir) {
  let t = Infinity;
  if (dir.x > 1e-9) t = Math.min(t, (FIELD.width - origin.x) / dir.x);
  if (dir.x < -1e-9) t = Math.min(t, (0 - origin.x) / dir.x);
  if (dir.y > 1e-9) t = Math.min(t, (FIELD.height - origin.y) / dir.y);
  if (dir.y < -1e-9) t = Math.min(t, (0 - origin.y) / dir.y);
  return t;
}

/**
 * Trace every beam in the world. Returns { segments, glows } where each
 * segment is {x1, y1, x2, y2, colour, power, chrono} and glows are the
 * bright points where beams strike glass, for the renderer's sparkle
 * pass and the particle system's sparks.
 */
export function traceBeams(world) {
  const segments = [];
  const glows = [];
  const startColour = world.night ? 'moon' : 'white';
  const lengthScale = 1 + 0.12 * world.tree.longerLight;
  const startPower = sunPowerScale(world);
  const stack = [beamState(world.sun.pos, world.sun.dir, startColour, startPower, BEAM_MAX_LENGTH * lengthScale, null, null)];
  let events = 0;

  while (stack.length > 0 && events < BEAM_MAX_EVENTS) {
    const beam = stack.pop();
    if (beam.budget <= 4 || beam.power < 0.03) continue;
    const hit = nearestEvent(world, beam);
    const travel = Math.min(hit.t, beam.budget);
    const end = {
      x: beam.origin.x + beam.dir.x * travel,
      y: beam.origin.y + beam.dir.y * travel,
    };
    segments.push({
      x1: beam.origin.x, y1: beam.origin.y, x2: end.x, y2: end.y,
      colour: beam.colour, power: beam.power, chrono: beam.chrono.size > 0,
    });
    if (hit.t > beam.budget || hit.kind === 'exit') continue;
    events += 1;
    glows.push({ x: end.x, y: end.y, colour: beam.colour });
    continueBeam(world, stack, beam, hit, end);
  }
  return { segments, glows };
}

/** The nearest thing a beam run strikes: glass, shadow, or open sky. */
function nearestEvent(world, beam) {
  let best = { t: rayExitField(beam.origin, beam.dir), kind: 'exit', tower: null };
  const consider = (t, kind, tower) => {
    if (t < best.t && t > 0.5) best = { t, kind, tower };
  };
  for (const tower of world.towers) {
    if (!tower.built) continue;
    if (tower.kind === 'mirror') {
      const face = mirrorFace(tower);
      const hit = raySegment(beam.origin, beam.dir, face.a, face.b);
      if (hit) consider(hit.t, 'mirror', tower);
    } else if (tower.kind === 'prism' || tower.kind === 'splitter' || tower.kind === 'shard' || tower.kind === 'storm') {
      consider(rayCircle(beam.origin, beam.dir, tower, tower.radius), tower.kind, tower);
    } else if (tower.kind === 'lens') {
      if (!beam.lenses.has(tower.id)) {
        consider(rayCircle(beam.origin, beam.dir, tower, tower.radius), 'lens', tower);
      }
    } else if (tower.kind === 'chrono') {
      if (!beam.chrono.has(tower.id)) {
        consider(rayCircle(beam.origin, beam.dir, tower, tower.radius), 'chrono', tower);
      }
    }
    // Dawn bells are passive (a dawn aura, not glass): beams pass over them.
  }
  if (world.eclipseDisc) {
    consider(rayCircle(beam.origin, beam.dir, world.eclipseDisc, world.eclipseDisc.radius), 'shadow', null);
  }
  if (world.weather) {
    for (const cloud of world.weather.clouds) {
      consider(rayCircle(beam.origin, beam.dir, cloud, cloud.rx * 0.92), 'cloud', null);
    }
  }
  return best;
}

/** Spawn whatever continues past an event: reflections, fans, forks, focus. */
function continueBeam(world, stack, beam, hit, at) {
  const tower = hit.tower;
  const spent = hit.t;
  const rest = beam.budget - spent;
  if (rest <= 4) return;
  const nudge = (dir) => ({ x: at.x + dir.x * 1.5, y: at.y + dir.y * 1.5 });
  const inherit = (dir, colour, power, budget = rest) => {
    stack.push(beamState(nudge(dir), dir, colour, power, budget, beam.lenses, beam.chrono));
  };
  switch (hit.kind) {
    case 'mirror': {
      const face = mirrorFace(tower);
      let n = face.normal;
      if (n.x * beam.dir.x + n.y * beam.dir.y > 0) n = { x: -n.x, y: -n.y };
      const dir = reflect(beam.dir, n);
      inherit(dir, beam.colour, beam.power * 0.96 * towerPower(tower));
      break;
    }
    case 'prism': {
      // Sunlight fans into the spectrum; a coloured beam is polished brighter.
      if (beam.colour === 'white' || beam.colour === 'moon') {
        const fan = [['ember', -0.30], ['gilded', 0], ['umbral', 0.30]];
        for (const [colour, off] of fan) {
          inherit(rotate(beam.dir, off), colour, beam.power * 0.62 * towerPower(tower));
        }
      } else {
        inherit(beam.dir, beam.colour, beam.power * 1.25 * towerPower(tower));
      }
      break;
    }
    case 'storm': {
      // The storm fan: the full spectrum, plus two raw strands thrown wide.
      if (beam.colour === 'white' || beam.colour === 'moon') {
        const fan = [
          ['ember', -0.34, 0.6], ['gilded', 0, 0.66], ['umbral', 0.34, 0.6],
          ['white', -0.66, 0.42], ['white', 0.66, 0.42],
        ];
        for (const [colour, off, share] of fan) {
          inherit(rotate(beam.dir, off), colour === 'white' && world.night ? 'moon' : colour, beam.power * share * towerPower(tower));
        }
      } else {
        inherit(beam.dir, beam.colour, beam.power * 1.3 * towerPower(tower));
      }
      break;
    }
    case 'splitter': {
      for (const off of [-0.38, 0.38]) {
        inherit(rotate(beam.dir, off), beam.colour, beam.power * 0.6 * towerPower(tower));
      }
      break;
    }
    case 'lens': {
      const lenses = new Set(beam.lenses);
      lenses.add(tower.id);
      stack.push(beamState(nudge(beam.dir), beam.dir, beam.colour, beam.power * 1.8 * towerPower(tower), rest * 1.35, lenses, beam.chrono));
      break;
    }
    case 'chrono': {
      // Time bends: sunlight and moonlight become chrono light outright;
      // a coloured beam keeps its colour but carries the stilling with it.
      const chrono = new Set(beam.chrono);
      chrono.add(tower.id);
      const colour = beam.colour === 'white' || beam.colour === 'moon' ? 'chrono' : beam.colour;
      stack.push(beamState(nudge(beam.dir), beam.dir, colour, beam.power * 1.12 * towerPower(tower), rest, beam.lenses, chrono));
      break;
    }
    case 'shard': {
      tower.charge = Math.min(1, (tower.charge || 0) + 0.34 * beam.power);
      break;
    }
    case 'shadow':
    case 'cloud':
    default:
      break; // Swallowed by shade, celestial or merely weather: the run ends.
  }
}

/** A tower's level scales the beams it touches (upgrade levels 0..3). */
function towerPower(tower) {
  return 1 + 0.35 * (tower.level || 0);
}

/**
 * Hurt every creature the traced segments touch. Fills per-enemy light
 * state the enemy update reads: lit (burning instead of healing), the
 * strongest slow upon it, and burn stacks for the damage-over-time pass.
 * Burrowed shades are underground: no segment reaches them.
 */
export function applyBeamDamage(world, segments, dt) {
  const widthScale = 1 + 0.2 * world.tree.wideBeam;
  for (const enemy of world.enemies) {
    if (!enemy.alive || !enemy.surfaced) { if (enemy.alive) enemy.lit = false; continue; }
    let lit = false;
    for (const seg of segments) {
      const near = closestOnSegment(enemy, { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 });
      const reach = BEAM_RADIUS * widthScale + enemy.radius * 0.45;
      if (near.dist > reach) continue;
      lit = true;
      const spec = SPECTRUM[seg.colour];
      const falloff = 1 - (near.dist / reach) * 0.35;
      const power = seg.power * falloff;
      let dps = spec.dps * power;
      if (seg.colour === 'ember') dps *= 1 + 0.35 * world.tree.emberPlus;
      if (seg.colour === 'gilded') dps *= 1 + 0.35 * world.tree.gildedPlus;
      if (enemy.armour) dps *= 1 - enemy.armour;
      enemy.hp -= dps * dt;
      if (spec.burn > 0) enemy.burn = Math.min(6, enemy.burn + spec.burn * power * dt);
      let slow = spec.slow;
      let slowTime = spec.slowTime;
      if (seg.colour === 'umbral') slow *= 1 + 0.12 * world.tree.umbralPlus;
      if (seg.chrono) {
        // Any beam that has passed a Chrono Lens stills what it touches.
        slow = Math.max(slow, 0.55 * (1 + 0.1 * world.tree.chronoPlus));
        slowTime = Math.max(slowTime, 1.3 * (1 + 0.15 * world.tree.chronoPlus));
      }
      if (slow > 0) {
        const capped = Math.min(0.8, slow);
        if (capped > enemy.slowFactor) {
          enemy.slowFactor = capped;
          enemy.slowTime = Math.max(enemy.slowTime, slowTime);
        }
      }
      if (enemy.hp <= 0 && enemy.alive) world.killEnemy(enemy, seg.colour);
    }
    enemy.lit = lit;
  }
}

/**
 * The beam melts Frostmere's ice: any segment passing over a frozen
 * sheet pours its power into the melt. A sheet at melt 1 is open water.
 * Returns the sheets that finished melting this step, for the world's
 * bookkeeping (achievements, steam, sound).
 */
export function meltIce(world, segments, dt) {
  if (!world.ice) return [];
  const finished = [];
  for (const sheet of world.ice) {
    if (sheet.melt >= 1) continue;
    let heat = 0;
    for (const seg of segments) {
      const near = closestOnSegment(sheet, { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 });
      if (near.dist < sheet.rx) heat += seg.power * (1 - near.dist / sheet.rx);
    }
    if (heat > 0) {
      sheet.melt = Math.min(1, sheet.melt + heat * dt * 0.055);
      if (sheet.melt >= 1) finished.push(sheet);
    }
  }
  return finished;
}

/** Distance from a point to the nearest segment (renderer diagnostics). */
export function beamDistance(segments, point) {
  let best = Infinity;
  for (const seg of segments) {
    const near = closestOnSegment(point, { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 });
    best = Math.min(best, near.dist);
  }
  return best;
}
