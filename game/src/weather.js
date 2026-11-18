// Weather: the clouds that eat the sun.
//
// Every island has its own sky. Clouds drift across the field on the
// wind; where a cloud is, its shadow is — a soft ellipse of shade on the
// ground that swallows the beam whole, exactly like the Eclipse's disc
// but slower, duller and everywhere. A cloud that crosses the sun
// itself starves the beam at its source. The player's answer is the
// same as ever: mirrors. Light already bent around a shadow keeps
// burning; light that must cross one does not arrive.
//
// Clouds are simulation state, not decoration: the optics tracer reads
// their shadows, the enemy update reads their shade (creatures heal
// faster under cloud), and the HUD warns when the sun is covered.

import { FIELD, GROUND, ISLAND_ART } from './config.js';
import { makeRng, hashSeed } from './rng.js';
import { clamp, distance } from './geometry.js';

/**
 * Build the weather for an island: a handful of clouds seeded by the
 * island's name, so a given island's sky is always recognisably itself.
 * Count comes from the island's art direction; ash clouds over the
 * Shoals are darker and faster, squalls over Frostmere slower and huge.
 */
export function makeWeather(islandIndex) {
  const art = ISLAND_ART[islandIndex];
  const rng = makeRng(hashSeed(`heliodrome-sky-${art.name}`));
  const clouds = [];
  const count = art.clouds + (islandIndex === 4 ? 1 : 0);
  for (let i = 0; i < count; i += 1) {
    const heavy = art.biome === 'frost' || art.biome === 'shoals';
    clouds.push({
      x: rng.range(GROUND.x + 60, GROUND.x + GROUND.width - 60),
      y: rng.range(GROUND.y + 30, GROUND.y + GROUND.height - 40),
      rx: rng.range(heavy ? 95 : 70, heavy ? 150 : 115),
      ry: rng.range(34, 52),
      vx: rng.range(7, 15) * (art.biome === 'shoals' ? 1.5 : 1) * rng.sign(),
      wobble: rng.range(0, Math.PI * 2),
      dark: art.biome === 'shoals' ? 0.5 : art.biome === 'frost' ? 0.42 : 0.3,
    });
  }
  return { clouds, wind: islandIndex === 2 ? -1 : 1 };
}

/** Advance the clouds: drift, wobble, wrap at the field's edges. */
export function updateWeather(world, dt) {
  const weather = world.weather;
  if (!weather) return;
  for (const cloud of weather.clouds) {
    cloud.x += cloud.vx * dt;
    cloud.y += Math.sin(world.time * 0.24 + cloud.wobble) * 2.4 * dt;
    if (cloud.x - cloud.rx > FIELD.width + 40) cloud.x = -cloud.rx - 30;
    if (cloud.x + cloud.rx < -40) cloud.x = FIELD.width + cloud.rx + 30;
    cloud.y = clamp(cloud.y, GROUND.y + 16, GROUND.y + GROUND.height - 10);
  }
}

/**
 * How much of the sun the sky is covering, 0..1. A cloud whose shadow
 * centre passes near the sun dims the whole beam at its source: at full
 * cover the beam leaves the sun at a quarter of its strength.
 */
export function sunCover(world) {
  if (!world.weather) return 0;
  let cover = 0;
  for (const cloud of world.weather.clouds) {
    const d = distance(cloud, world.sun.pos);
    const reach = cloud.rx * 0.9;
    if (d < reach) cover = Math.max(cover, 1 - d / reach);
  }
  return clamp(cover, 0, 1);
}

/** Beam power multiplier at the source, given the sky's cover. */
export function sunPowerScale(world) {
  return 1 - 0.75 * sunCover(world);
}

/**
 * True when a point stands in cloud shadow. Shades under cloud heal as
 * if it were night-shadow; the optics tracer treats the same ellipses
 * as beam swallowers.
 */
export function inCloudShadow(world, point) {
  if (!world.weather) return false;
  for (const cloud of world.weather.clouds) {
    const dx = (point.x - cloud.x) / cloud.rx;
    const dy = (point.y - cloud.y) / cloud.ry;
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}

/** A short forecast line for the HUD: what the sky is doing right now. */
export function skyReport(world) {
  const cover = sunCover(world);
  if (cover > 0.55) return 'The sun is covered — the beam starves.';
  if (cover > 0.2) return 'Cloud crosses the sun.';
  if (world.weather && world.weather.clouds.length > 0) return 'Cloud shadows drift below.';
  return 'Clear sky.';
}
