// Shade creatures: spawning, walking the path, burning, healing, dying.
//
// An enemy is a point travelling the island's polyline by arc length.
// Each step it advances by its speed — cut by whatever slow the light
// has laid on it, hurried by unbroken ice, dragged by open water — then
// the light's bookkeeping runs: burning stacks tick down as damage, and
// a creature standing in shadow knits itself back together (by day).
// Night inverts the bargain: in shadow the shades surge forward faster,
// and only the moonbeam's deep slow holds them. Cloud shadow counts as
// shadow for healing, day or night.
//
// Two kinds break the walking rules. Deepburrowers travel underground
// in stretches — no beam can touch them down there, and they surface
// where they please. The Dreadnought simply refuses to care: plated in
// woven shade, it shrugs off nearly half of everything and splits into
// Greater Shades when it finally falls.
//
// Deaths are reported to the world (gold, particles, sound); arrivals
// at the Heart Crystal cost lives. The Eclipse is an enemy like any
// other here, except that it carries the shadow disc the optics must
// respect.

import { ENEMIES, waveHpScale, waveSpeedScale } from './config.js';
import { pointAlong, polylineLength, insideEllipse } from './geometry.js';
import { inCloudShadow } from './weather.js';

let nextEnemyId = 1;

/** Create an enemy of `kind` at the start of the island's path. */
export function spawnEnemy(world, kind) {
  const base = ENEMIES[kind];
  const hp = base.hp * waveHpScale(world.wave) * (kind === 'eclipse' ? 1 + (world.wave / 10 - 1) * 0.7 : 1);
  const enemy = {
    id: nextEnemyId,
    kind,
    x: world.island.gate.x,
    y: world.island.gate.y,
    dist: 0,
    hp,
    maxHp: hp,
    speed: base.speed * waveSpeedScale(world.wave),
    radius: base.radius,
    reward: base.reward,
    leak: base.leak,
    shadeHeal: base.shadeHeal,
    armourBase: base.armour || 0,
    armour: base.armour || 0,
    burn: 0,
    slowFactor: 0,
    slowTime: 0,
    lit: false,
    alive: true,
    wobble: (nextEnemyId * 7919) % 628 / 100,
    veilTimer: kind === 'veil' ? 4 : 0,
    veiled: false,
    surfaced: true,
    surfaceTimer: kind === 'burrower' ? 2.6 : 0,
    bornAt: world.time,
  };
  nextEnemyId += 1;
  world.enemies.push(enemy);
  return enemy;
}

/**
 * The ground under a point, as the shades feel it: 'ice' (fast), 'water'
 * (slow), or 'road'. Reads the run's melt state for the island's sheets.
 */
export function groundAt(world, point) {
  if (!world.ice) return 'road';
  for (const sheet of world.ice) {
    if (insideEllipse(point, sheet, sheet.rx, sheet.ry)) {
      return sheet.melt >= 0.85 ? 'water' : 'ice';
    }
  }
  return 'road';
}

/** Advance every living enemy one step; reap arrivals and the burned. */
export function updateEnemies(world, dt) {
  const pathLength = polylineLength(world.island.path);
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;

    // Slows laid by the light fade; veils come and go on their own clock.
    if (enemy.slowTime > 0) {
      enemy.slowTime -= dt;
      if (enemy.slowTime <= 0) enemy.slowFactor = 0;
    }
    if (enemy.kind === 'veil') {
      enemy.veilTimer -= dt;
      if (enemy.veilTimer <= 0) {
        enemy.veiled = !enemy.veiled;
        enemy.veilTimer = enemy.veiled ? 2.2 : 6.5;
      }
    }
    enemy.armour = Math.max(enemy.armourBase, enemy.veiled ? 0.65 : 0);

    // Deepburrowers surface and dive on a patient rhythm: three seconds
    // up where the light can find them, two and a half down where it
    // cannot. The dive is telegraphed by the mound's trembling.
    if (enemy.kind === 'burrower') {
      enemy.surfaceTimer -= dt;
      if (enemy.surfaceTimer <= 0) {
        enemy.surfaced = !enemy.surfaced;
        enemy.surfaceTimer = enemy.surfaced ? 3.1 : 2.4;
      }
    }

    // Burning stacks: damage over time the light already paid for.
    // A burrowed creature smothers its own flames in the dark earth.
    if (enemy.burn > 0 && enemy.surfaced) {
      const tick = Math.min(enemy.burn, 22 * dt);
      enemy.burn -= tick * 0.55;
      enemy.hp -= tick * 2.4;
      if (enemy.hp <= 0) {
        world.killEnemy(enemy, 'burn');
        continue;
      }
    }

    // The shadow bargain: unlit shades heal by day; by night they surge.
    // Cloud shadow is shadow too. Buried shades heal slowly underground.
    let speedScale = 1 - enemy.slowFactor;
    if (!enemy.surfaced) {
      speedScale *= 0.82;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.shadeHeal * 0.4 * dt);
    } else if (!enemy.lit) {
      if (world.night) speedScale *= 1.25;
      else {
        const heal = enemy.shadeHeal * (inCloudShadow(world, enemy) ? 1.6 : 1);
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal * dt);
      }
    }

    // The ground itself argues: ice hurries, open water drags.
    const ground = groundAt(world, enemy);
    if (ground === 'ice') speedScale *= 1.45;
    else if (ground === 'water') speedScale *= 0.78;

    enemy.dist += enemy.speed * speedScale * dt;
    const placed = pointAlong(world.island.path, enemy.dist);
    // A gentle perpendicular sway so a column of shades reads as creatures,
    // not beads on a wire. Bosses and colossi are too heavy to sway.
    const sway = enemy.radius < 20 ? Math.sin(world.time * 2.1 + enemy.wobble) * 4 : 0;
    enemy.x = placed.point.x + -placed.dir.y * sway;
    enemy.y = placed.point.y + placed.dir.x * sway;
    enemy.dir = placed.dir;

    if (enemy.dist >= pathLength - 2) {
      enemy.alive = false;
      enemy.arrived = true;
      world.leakEnemy(enemy);
    }
  }
  world.enemies = world.enemies.filter((e) => e.alive);
}

/**
 * The Eclipse drags its shadow with it: a disc that orbits the boss
 * slowly, swallowing any beam that tries to cross it. When no boss is on
 * the field there is no disc.
 */
export function updateEclipseDisc(world) {
  const boss = world.enemies.find((e) => e.alive && e.kind === 'eclipse');
  if (!boss) {
    world.eclipseDisc = null;
    return;
  }
  const orbit = world.time * 0.7;
  world.eclipseDisc = {
    x: boss.x + Math.cos(orbit) * 88,
    y: boss.y + Math.sin(orbit) * 88 - 20,
    radius: 76,
  };
  world.bossRef = boss;
}

/** True while any living enemy remains (the wave is not yet cleared). */
export function anyEnemyAlive(world) {
  return world.enemies.some((e) => e.alive);
}
