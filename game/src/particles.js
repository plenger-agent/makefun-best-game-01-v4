// Particles: the game's confetti of light, ash, steam and snow.
//
// One pooled system serves every effect: sparks where the beam strikes
// glass, embers off burning shades, ash when a shade dies, steam where
// the beam boils Frostmere's ice, spray where it strikes open water,
// drifting snow and ash as island ambience. Particles are plain records
// updated in place; the renderer draws them additively so light feels
// like light.

/** Create an empty particle pool. */
export function makeParticles() {
  return { list: [], cap: 1500 };
}

/** Add one particle. Fields: position, velocity, life, size, colour, drag, gravity, glow. */
export function spawnParticle(pool, p) {
  if (pool.list.length >= pool.cap) pool.list.shift();
  pool.list.push({
    x: p.x, y: p.y,
    vx: p.vx || 0, vy: p.vy || 0,
    t: 0, ttl: p.ttl || 0.6,
    size: p.size || 3,
    colour: p.colour || '#ffd98a',
    drag: p.drag ?? 0.92,
    gravity: p.gravity ?? 0,
    glow: p.glow ?? true,
    shrink: p.shrink ?? true,
  });
}

/** A burst of sparks where light strikes glass or a shade bursts. */
export function burst(pool, x, y, colour, count, speed, rng) {
  for (let i = 0; i < count; i += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const v = rng.range(speed * 0.25, speed);
    spawnParticle(pool, {
      x, y,
      vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 12,
      ttl: rng.range(0.25, 0.7), size: rng.range(1.5, 3.6),
      colour, gravity: 60, drag: 0.9,
    });
  }
}

/** A shade dies: a soft collapse of ash and one bright seed of light. */
export function deathPuff(pool, x, y, radius, rng) {
  burst(pool, x, y, '#8f86a8', Math.min(18, 6 + radius), 95, rng);
  burst(pool, x, y, '#ffe9a8', 5, 55, rng);
}

/** A burning shade sheds embers as it walks. */
export function emberTrail(pool, enemy, rng) {
  if (!rng.chance(0.4)) return;
  spawnParticle(pool, {
    x: enemy.x + rng.range(-6, 6), y: enemy.y + rng.range(-6, 6),
    vx: rng.range(-8, 8), vy: rng.range(-36, -14),
    ttl: rng.range(0.3, 0.65), size: rng.range(1.6, 3.4),
    colour: rng.pick(['#ff7a3c', '#ffc93c', '#ff9a5c']), gravity: -30, drag: 0.96,
  });
}

/** Sparks thrown off where a beam strikes glass or ground. */
export function beamSpark(pool, x, y, colour, rng) {
  if (!rng.chance(0.3)) return;
  const angle = rng.range(0, Math.PI * 2);
  const v = rng.range(14, 52);
  spawnParticle(pool, {
    x, y,
    vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 8,
    ttl: rng.range(0.18, 0.45), size: rng.range(1.2, 2.6),
    colour, gravity: 40, drag: 0.92,
  });
}

/** Steam where the beam boils ice into open water. */
export function meltSteam(pool, x, y, rng) {
  if (!rng.chance(0.25)) return;
  spawnParticle(pool, {
    x: x + rng.range(-16, 16), y: y + rng.range(-8, 8),
    vx: rng.range(-5, 5), vy: rng.range(-30, -16),
    ttl: rng.range(0.5, 1.1), size: rng.range(3, 6.5),
    colour: '#e8f4ff', gravity: -18, drag: 0.97, glow: false,
  });
}

/** Spray where the beam strikes open water or a melted sheet. */
export function waterSplash(pool, x, y, rng) {
  if (!rng.chance(0.2)) return;
  spawnParticle(pool, {
    x, y,
    vx: rng.range(-22, 22), vy: rng.range(-44, -18),
    ttl: rng.range(0.3, 0.55), size: rng.range(1.4, 2.8),
    colour: rng.pick(['#bfe8ff', '#e8f7ff', '#8fc8e8']), gravity: 150, drag: 0.98,
  });
}

/** Ambient weather: snow over Frostmere, ash over the Shoals. */
export function ambientDrift(pool, biome, rng, field) {
  const frost = biome === 'frost';
  if (!rng.chance(frost ? 0.75 : 0.4)) return;
  spawnParticle(pool, {
    x: rng.range(0, field.width), y: rng.range(-6, 40),
    vx: rng.range(-14, -4), vy: rng.range(16, 34),
    ttl: rng.range(2.2, 4), size: rng.range(1.4, 3),
    colour: frost ? '#ffffff' : '#c9a184', gravity: 0, drag: 1, shrink: false,
  });
}

/** A golden burst when an achievement lands. */
export function achievementBurst(pool, x, y, rng) {
  burst(pool, x, y, '#ffd94e', 22, 130, rng);
  burst(pool, x, y, '#fff6d8', 10, 80, rng);
}

/** Advance every particle; dead ones are swapped out. */
export function updateParticles(pool, dt) {
  const list = pool.list;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.t += dt;
    if (p.t >= p.ttl) {
      list[i] = list[list.length - 1];
      list.pop();
      continue;
    }
    const dragK = Math.pow(p.drag, dt * 60);
    p.vx *= dragK;
    p.vy = p.vy * dragK + p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}
