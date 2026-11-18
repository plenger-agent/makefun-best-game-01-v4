// Towers: building, upgrading, selling, and the three active towers.
//
// A tower is a record on a build pad: {id, kind, pad, x, y, angle, level,
// spent, charge, timer}. Mirrors and eclipse shards are aimed with the
// angle (the player rotates them); the other six are round glass and
// work from any side. The optics module reads the mirrors, prisms,
// lenses, splitters, shards, chrono lenses and storm prisms; this
// module owns the economy around them and the towers with behaviour of
// their own: the Dawn Bell, which rings a slowing peal; the Eclipse
// Shard, which drinks the beam and fires it back as a lance; and the
// Storm Prism, which calls lightning down on whatever the light holds.

import { TOWERS, UPGRADE_COST, UPGRADE_POWER, SELL_SHARE } from './config.js';
import { closestOnSegment } from './geometry.js';

let nextTowerId = 1;

/** Cost to build a kind right now (spectrum-tree discounts applied). */
export function buildCost(world, kind) {
  const discount = 1 - 0.08 * world.tree.swiftHands;
  return Math.round(TOWERS[kind].cost * discount);
}

/** Cost to raise a tower one level, or null at the cap (level 3). */
export function upgradeCost(tower) {
  if (tower.level >= 3) return null;
  return UPGRADE_COST[tower.level];
}

/** Place a tower of `kind` on `pad` if the player can afford it. */
export function buildTower(world, kind, pad) {
  const cost = buildCost(world, kind);
  if (world.gold < cost || pad.tower) return null;
  const tower = {
    id: nextTowerId,
    kind,
    pad,
    x: pad.x,
    y: pad.y,
    radius: TOWERS[kind].radius,
    angle: -Math.PI / 4,
    level: 0,
    spent: cost,
    charge: 0,
    timer: 0,
    built: true,
  };
  nextTowerId += 1;
  pad.tower = tower;
  world.towers.push(tower);
  world.gold -= cost;
  world.stats.built += 1;
  world.audio?.build();
  return tower;
}

/** Raise a tower's level; returns true when the upgrade went through. */
export function upgradeTower(world, tower) {
  const cost = upgradeCost(tower);
  if (cost === null || world.gold < cost) return false;
  world.gold -= cost;
  tower.spent += cost;
  tower.level += 1;
  world.audio?.upgrade();
  return true;
}

/** Sell a tower back for a share of everything spent on it. */
export function sellTower(world, tower) {
  const value = Math.floor(tower.spent * SELL_SHARE);
  world.gold += value;
  tower.pad.tower = null;
  world.towers = world.towers.filter((t) => t !== tower);
  if (world.selected === tower) world.selected = null;
  world.audio?.sell();
  return value;
}

/** Rotate an aimed tower (mirror or shard) by delta radians. */
export function rotateTower(tower, delta) {
  tower.angle += delta;
}

/**
 * Per-step tower behaviour: dawn bells ring, eclipse shards fire,
 * storm prisms call the lightning. Their damage is applied here, not in
 * the optics; the renderer draws their effects from world.effects.
 */
export function updateTowers(world, dt) {
  for (const tower of world.towers) {
    if (tower.kind === 'bell') updateBell(world, tower, dt);
    if (tower.kind === 'shard') updateShard(world, tower, dt);
    if (tower.kind === 'storm') updateStorm(world, tower, dt);
  }
}

/** The Dawn Bell peals every 18 seconds: every shade slows and shivers. */
function updateBell(world, tower, dt) {
  tower.timer -= dt;
  if (tower.timer > 0) return;
  tower.timer = 18;
  const power = 1 + 0.35 * tower.level;
  for (const enemy of world.enemies) {
    if (!enemy.alive || !enemy.surfaced) continue;
    enemy.slowFactor = Math.max(enemy.slowFactor, 0.3);
    enemy.slowTime = Math.max(enemy.slowTime, 3.5);
    enemy.hp -= 12 * power;
    if (enemy.hp <= 0 && enemy.alive) world.killEnemy(enemy, 'bell');
  }
  world.effects.push({ kind: 'ring', x: tower.x, y: tower.y, t: 0, ttl: 0.9, radius: 30 });
  world.audio?.bell();
}

/**
 * A charged Eclipse Shard fires a lance through the thickest knot of
 * shades: a piercing line from the shard through the nearest creature,
 * wounding everything along it. It then needs the beam again to recharge.
 */
function updateShard(world, tower, dt) {
  tower.timer -= dt;
  if (tower.charge < 1 || tower.timer > 0) return;
  const target = nearestEnemy(world, tower);
  if (!target) return;
  tower.charge = 0;
  tower.timer = 1.2;
  const power = (1 + 0.35 * tower.level) * 260;
  const from = { x: tower.x, y: tower.y };
  const dir = { x: target.x - tower.x, y: target.y - tower.y };
  const len = Math.hypot(dir.x, dir.y) || 1;
  const to = { x: tower.x + (dir.x / len) * 620, y: tower.y + (dir.y / len) * 620 };
  for (const enemy of world.enemies) {
    if (!enemy.alive || !enemy.surfaced) continue;
    const near = closestOnSegment(enemy, from, to);
    if (near.dist < 20 + enemy.radius * 0.4) {
      enemy.hp -= power;
      enemy.lit = true;
      if (enemy.hp <= 0 && enemy.alive) world.killEnemy(enemy, 'shard');
    }
  }
  world.effects.push({ kind: 'lance', x1: from.x, y1: from.y, x2: to.x, y2: to.y, t: 0, ttl: 0.22 });
  world.audio?.lance();
}

/**
 * The Storm Prism calls lightning: every few seconds it finds the lit
 * shade nearest it and arcs a bolt through that shade and its nearest
 * neighbours — lightning only strikes what the light already holds, so
 * a storm prism with no beam is just expensive glass. Faraday Crown
 * blessings make the arcs longer and crueller.
 */
function updateStorm(world, tower, dt) {
  tower.timer -= dt;
  if (tower.timer > 0) return;
  tower.timer = 2.3;
  const lit = world.enemies.filter((e) => e.alive && e.surfaced && e.lit);
  if (lit.length === 0) return;
  lit.sort((a, b) => dist2(a, tower) - dist2(b, tower));
  const arcs = 4 + world.tree.stormPlus;
  const damage = (95 + 40 * tower.level) * (1 + 0.4 * world.tree.stormPlus);
  const chain = [lit[0]];
  const struck = new Set([lit[0].id]);
  while (chain.length < arcs) {
    const from = chain[chain.length - 1];
    let best = null;
    let bestDist = 150 * 150;
    for (const enemy of lit) {
      if (struck.has(enemy.id)) continue;
      const d = dist2(enemy, from);
      if (d < bestDist) { bestDist = d; best = enemy; }
    }
    if (!best) break;
    struck.add(best.id);
    chain.push(best);
  }
  const points = [{ x: tower.x, y: tower.y - 14 }, ...chain.map((e) => ({ x: e.x, y: e.y }))];
  for (const enemy of chain) {
    enemy.hp -= damage;
    if (enemy.hp <= 0 && enemy.alive) world.killEnemy(enemy, 'storm');
  }
  world.effects.push({ kind: 'zap', points, t: 0, ttl: 0.18 });
  world.audio?.zap();
}

/** Squared distance between two points (chain searches only compare). */
function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** The living, surfaced enemy nearest a point, or null when clear. */
function nearestEnemy(world, point) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of world.enemies) {
    if (!enemy.alive || !enemy.surfaced) continue;
    const d = Math.hypot(enemy.x - point.x, enemy.y - point.y);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

/** Total the player has invested in a tower (for the info card). */
export function towerInvested(tower) {
  return tower.spent;
}

/** Beam strength multiplier a tower applies at its current level. */
export function towerStrength(tower) {
  return Math.pow(UPGRADE_POWER, tower.level);
}
