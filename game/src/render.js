// Rendering: everything the player sees, drawn fresh each frame.
//
// Layers, back to front: sky and sun (or moon) with the drifting
// clouds; the island's ground (pre-rendered to an offscreen canvas per
// island and lighting, since the terrain itself never changes mid-wave)
// with its living overlays — shore foam, lava glow, melting ice, cloud
// shadows; the Heart Crystal and its glow; towers; the shades; the
// beams themselves, drawn additively in three passes so the light
// glows; then particles, effects, a vignette, and finally the HUD, the
// build bar, banners and achievement toasts. Buttons and cards register
// their rectangles into world.uiRegions as they are drawn; screens.js
// dispatches clicks against that list, so the visible interface and the
// clickable one can never drift apart.

import {
  FIELD, SKY_HEIGHT, BAR_HEIGHT, GROUND, SPECTRUM, TOWERS, TOWER_TAGS,
  ISLAND_ART, NIGHT_ART,
} from './config.js';
import { clamp, distance, smooth, lerpColour, polylineLength, pointAlong } from './geometry.js';
import { makeRng, hashSeed } from './rng.js';
import { sunCover } from './weather.js';

const groundCache = new Map();

/** Main entry: draw the whole scene for the current world state. */
export function drawScene(ctx, world, input) {
  world.uiRegions = [];
  ctx.save();
  if (world.shake > 0) {
    const s = world.shake * 7;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawSky(ctx, world);
  drawGround(ctx, world);
  drawDynamicGround(ctx, world);
  drawCrystal(ctx, world);
  drawPads(ctx, world, input);
  drawTowers(ctx, world);
  drawEnemies(ctx, world);
  drawBeams(ctx, world);
  drawEclipseDisc(ctx, world);
  drawEffects(ctx, world);
  drawParticles(ctx, world);
  drawVignette(ctx, world);
  ctx.restore();
  drawHud(ctx, world, input);
  drawBuildBar(ctx, world, input);
  if (world.banner) drawBanner(ctx, world);
  drawToasts(ctx, world);
}

/** Sky gradient by day phase, sun or moon with halo, stars, clouds. */
function drawSky(ctx, world) {
  const art = world.night ? NIGHT_ART : ISLAND_ART[world.islandIndex];
  const dayness = world.night ? 0 : Math.sin(Math.PI * clamp(world.sun.phase, 0, 1));
  const grad = ctx.createLinearGradient(0, 0, 0, SKY_HEIGHT + 60);
  if (world.night) {
    grad.addColorStop(0, art.skyTop);
    grad.addColorStop(0.62, art.skyMid);
    grad.addColorStop(1, art.skyLow);
  } else {
    grad.addColorStop(0, lerpColour('#232c4e', art.skyTop, 0.3 + 0.7 * dayness));
    grad.addColorStop(0.62, lerpColour('#4a3a5e', art.skyMid, 0.35 + 0.65 * dayness));
    grad.addColorStop(1, art.skyLow);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD.width, SKY_HEIGHT + 60);

  if (world.night) {
    ctx.fillStyle = 'rgba(230,238,255,0.8)';
    for (let i = 0; i < 80; i += 1) {
      const sx = (i * 173.3) % FIELD.width;
      const sy = (i * 57.7) % (SKY_HEIGHT - 18);
      ctx.globalAlpha = 0.2 + ((i * 31) % 10) / 13;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  const { x, y } = world.sun.pos;
  const sunR = world.night ? 21 : 27;
  const halo = ctx.createRadialGradient(x, y, 2, x, y, sunR * 4.6);
  if (world.night) {
    halo.addColorStop(0, 'rgba(190,210,255,0.55)');
    halo.addColorStop(1, 'rgba(190,210,255,0)');
  } else {
    halo.addColorStop(0, 'rgba(255,214,120,0.75)');
    halo.addColorStop(0.4, 'rgba(255,170,80,0.28)');
    halo.addColorStop(1, 'rgba(255,160,60,0)');
  }
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, sunR * 4.6, 0, Math.PI * 2);
  ctx.fill();
  const core = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, sunR);
  if (world.night) {
    core.addColorStop(0, '#f4f8ff');
    core.addColorStop(1, '#aebfe8');
  } else {
    core.addColorStop(0, '#fffbe8');
    core.addColorStop(0.7, '#ffe9a0');
    core.addColorStop(1, '#ffb84e');
  }
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, sunR, 0, Math.PI * 2);
  ctx.fill();
  if (world.night) {
    ctx.fillStyle = 'rgba(140,160,205,0.5)';
    ctx.beginPath();
    ctx.arc(x - 7, y - 5, 4, 0, Math.PI * 2);
    ctx.arc(x + 6, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  drawCloudBodies(ctx, world);
}

/**
 * The clouds themselves, floating a hand's breadth above their shadows:
 * soft stacked ellipses, white over the coast, grey over the cliffs,
 * black-red over the Shoals, heavy white over Frostmere.
 */
function drawCloudBodies(ctx, world) {
  if (!world.weather) return;
  const biome = ISLAND_ART[world.islandIndex].biome;
  for (const cloud of world.weather.clouds) {
    const bx = cloud.x - 30;
    const by = cloud.y - 118;
    if (by < -70 || by > FIELD.height) continue;
    ctx.save();
    ctx.translate(bx, by);
    const puffs = [[0, 0, 1], [-0.55, 6, 0.7], [0.55, 7, 0.75], [-0.25, -10, 0.62], [0.3, -8, 0.66]];
    for (const [ox, oy, s] of puffs) {
      const r = cloud.rx * 0.52 * s;
      const g = ctx.createRadialGradient(ox * cloud.rx * 0.8, oy - 4, 2, ox * cloud.rx * 0.8, oy, r);
      if (world.night) {
        g.addColorStop(0, 'rgba(52,60,86,0.85)');
        g.addColorStop(1, 'rgba(52,60,86,0)');
      } else if (biome === 'shoals') {
        g.addColorStop(0, 'rgba(74,44,40,0.88)');
        g.addColorStop(1, 'rgba(74,44,40,0)');
      } else if (biome === 'frost') {
        g.addColorStop(0, 'rgba(240,248,255,0.92)');
        g.addColorStop(1, 'rgba(240,248,255,0)');
      } else {
        g.addColorStop(0, 'rgba(255,252,246,0.9)');
        g.addColorStop(1, 'rgba(255,252,246,0)');
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ox * cloud.rx * 0.8, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** The island's ground, cached per island and lighting. */
function drawGround(ctx, world) {
  const key = `${world.islandIndex}-${world.night ? 'n' : 'd'}`;
  let cached = groundCache.get(key);
  if (!cached) {
    cached = document.createElement('canvas');
    cached.width = FIELD.width;
    cached.height = FIELD.height;
    paintGround(cached.getContext('2d'), world);
    groundCache.set(key, cached);
  }
  ctx.drawImage(cached, 0, 0);
}

/** Paint the static ground: sea rim, earth, biome texture, road, dressing. */
function paintGround(ctx, world) {
  const art = world.night ? NIGHT_ART : ISLAND_ART[world.islandIndex];
  const island = world.island;
  ctx.fillStyle = art.sea || '#274b63';
  ctx.fillRect(0, SKY_HEIGHT, FIELD.width, FIELD.height - SKY_HEIGHT);
  const grad = ctx.createLinearGradient(0, GROUND.y, 0, GROUND.y + GROUND.height);
  grad.addColorStop(0, art.groundLight);
  grad.addColorStop(0.5, art.ground);
  grad.addColorStop(1, art.groundDark);
  ctx.fillStyle = grad;
  roundRect(ctx, GROUND.x - 8, GROUND.y - 8, GROUND.width + 16, GROUND.height + 16, 26);
  ctx.fill();

  // Soft tonal blotches so the earth reads as terrain, not a fill.
  for (let i = 0; i < 30; i += 1) {
    const bx = GROUND.x + ((i * 211.7) % GROUND.width);
    const by = GROUND.y + ((i * 127.3) % GROUND.height);
    const br = 40 + ((i * 53) % 90);
    const blob = ctx.createRadialGradient(bx, by, 2, bx, by, br);
    blob.addColorStop(0, i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)');
    blob.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!world.night) paintBiomeTexture(ctx, world, art);

  // The shade road: a dark worn trail with a lighter worn edge.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = art.pathEdge;
  ctx.lineWidth = 34;
  strokePath(ctx, island.path);
  ctx.strokeStyle = art.path;
  ctx.lineWidth = 27;
  strokePath(ctx, island.path);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 22]);
  strokePath(ctx, island.path);
  ctx.setLineDash([]);
  paintRoadTrim(ctx, world);

  // The cave mouth at the gate.
  const gate = island.gate;
  ctx.fillStyle = '#0a0910';
  ctx.beginPath();
  ctx.ellipse(gate.x + 6, gate.y, 20, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = art.rock;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(gate.x + 6, gate.y, 20, 30, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Set dressing, kept off the road and the pads.
  for (const item of island.dressing) {
    if (nearPath(island, item.x, item.y, 26)) continue;
    if (island.pads.some((p) => distance(p, item) < 30)) continue;
    drawDressing(ctx, item, art);
  }
}

/**
 * The biome's own ground texture, painted from a seeded generator so a
 * given island's earth is the same every visit: grass and flowers on
 * the coast, cracked ripples in the desert, slabs and moss on the
 * cliffs, basalt and lava on the Shoals, drifts and sparkle on
 * Frostmere. Hundreds of small strokes — this is what makes the field
 * read as a place instead of a board.
 */
function paintBiomeTexture(ctx, world, art) {
  const rng = makeRng(hashSeed(`heliodrome-earth-${world.island.name}`));
  const biome = art.biome;
  const W = GROUND.width;
  const H = GROUND.height;
  if (biome === 'coast') {
    // Grass blades in clusters.
    for (let i = 0; i < 340; i += 1) {
      const x = GROUND.x + rng.range(6, W - 6);
      const y = GROUND.y + rng.range(6, H - 6);
      ctx.strokeStyle = rng.chance(0.5) ? art.tuft : art.groundDark;
      ctx.globalAlpha = rng.range(0.35, 0.8);
      ctx.lineWidth = 1.6;
      for (let b = -1; b <= 1; b += 1) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + b * 2, y - 6, x + b * 3.4, y - rng.range(7, 12));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // Flower specks.
    for (let i = 0; i < 90; i += 1) {
      const x = GROUND.x + rng.range(6, W - 6);
      const y = GROUND.y + rng.range(6, H - 6);
      ctx.fillStyle = rng.chance(0.5) ? art.flowerA : art.flowerB;
      ctx.globalAlpha = rng.range(0.5, 0.95);
      for (let p = 0; p < 4; p += 1) {
        const a = (p / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd94e';
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Sand patches toward the shore (the south edge).
    for (let i = 0; i < 12; i += 1) {
      const x = GROUND.x + rng.range(20, W - 20);
      const y = GROUND.y + H - rng.range(4, 60);
      ctx.fillStyle = 'rgba(232,214,160,0.20)';
      ctx.beginPath();
      ctx.ellipse(x, y, rng.range(26, 70), rng.range(8, 18), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (biome === 'desert') {
    // Wind ripples: ranks of shallow arcs.
    ctx.strokeStyle = 'rgba(122,95,66,0.35)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 120; i += 1) {
      const x = GROUND.x + rng.range(6, W - 6);
      const y = GROUND.y + rng.range(6, H - 6);
      const r = rng.range(8, 22);
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.6);
      ctx.stroke();
    }
    // Cracked earth: jagged dark polylines that branch once.
    ctx.strokeStyle = 'rgba(74,54,32,0.5)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 46; i += 1) {
      let x = GROUND.x + rng.range(10, W - 10);
      let y = GROUND.y + rng.range(10, H - 10);
      let a = rng.range(0, Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = rng.int(3, 6);
      for (let s = 0; s < segs; s += 1) {
        a += rng.range(-0.7, 0.7);
        x += Math.cos(a) * rng.range(8, 20);
        y += Math.sin(a) * rng.range(8, 20);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Pebble fields.
    for (let i = 0; i < 130; i += 1) {
      const x = GROUND.x + rng.range(4, W - 4);
      const y = GROUND.y + rng.range(4, H - 4);
      ctx.fillStyle = rng.chance(0.5) ? 'rgba(138,111,77,0.7)' : 'rgba(230,200,126,0.55)';
      ctx.beginPath();
      ctx.ellipse(x, y, rng.range(1.6, 3.6), rng.range(1.2, 2.4), rng.range(0, 3), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (biome === 'cliffs') {
    // Stone slabs: big flat polygons with lit edges.
    for (let i = 0; i < 26; i += 1) {
      const x = GROUND.x + rng.range(20, W - 20);
      const y = GROUND.y + rng.range(20, H - 20);
      const r = rng.range(22, 52);
      ctx.fillStyle = `rgba(${i % 2 ? '255,255,255' : '0,0,0'},${rng.range(0.03, 0.08)})`;
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2 + rng.range(-0.2, 0.2);
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r * 0.7;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,16,30,0.35)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    // Moss in the slab joints.
    for (let i = 0; i < 110; i += 1) {
      const x = GROUND.x + rng.range(6, W - 6);
      const y = GROUND.y + rng.range(6, H - 6);
      ctx.fillStyle = `rgba(70,96,64,${rng.range(0.2, 0.5)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rng.range(3, 9), rng.range(2, 5), rng.range(0, 3), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (biome === 'shoals') {
    // Basalt ground: dark polygonal plates.
    for (let i = 0; i < 34; i += 1) {
      const x = GROUND.x + rng.range(20, W - 20);
      const y = GROUND.y + rng.range(20, H - 20);
      const r = rng.range(18, 44);
      ctx.fillStyle = `rgba(${i % 2 ? '255,190,140' : '0,0,0'},${rng.range(0.03, 0.07)})`;
      ctx.beginPath();
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r * 0.74;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(10,6,8,0.5)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    // Lava pools: dark rims around bright, cracked hearts.
    for (let i = 0; i < 7; i += 1) {
      const x = GROUND.x + 90 + ((i * 331.7) % (W - 180));
      const y = GROUND.y + 60 + ((i * 197.3) % (H - 120));
      if (nearPath(world.island, x, y, 64)) continue;
      const rx = rng.range(30, 52);
      const ry = rx * 0.55;
      ctx.fillStyle = '#120a0a';
      ctx.beginPath();
      ctx.ellipse(x, y, rx + 9, ry + 7, 0, 0, Math.PI * 2);
      ctx.fill();
      const lava = ctx.createRadialGradient(x, y, 2, x, y, rx);
      lava.addColorStop(0, '#ffd23c');
      lava.addColorStop(0.45, '#ff7a2a');
      lava.addColorStop(1, '#a8230f');
      ctx.fillStyle = lava;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(30,8,4,0.8)';
      ctx.lineWidth = 2;
      for (let c = 0; c < 4; c += 1) {
        ctx.beginPath();
        ctx.moveTo(x - rx * 0.7 + c * rx * 0.35, y - ry * 0.4);
        ctx.lineTo(x - rx * 0.5 + c * rx * 0.35, y + ry * 0.4);
        ctx.stroke();
      }
    }
    // Ash dusting.
    for (let i = 0; i < 120; i += 1) {
      const x = GROUND.x + rng.range(4, W - 4);
      const y = GROUND.y + rng.range(4, H - 4);
      ctx.fillStyle = `rgba(200,180,168,${rng.range(0.05, 0.16)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rng.range(3, 10), rng.range(2, 5), rng.range(0, 3), 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (biome === 'frost') {
    // Snow drifts: soft white mounds with blue shadow edges.
    for (let i = 0; i < 60; i += 1) {
      const x = GROUND.x + rng.range(10, W - 10);
      const y = GROUND.y + rng.range(10, H - 10);
      const rx = rng.range(16, 44);
      const ry = rx * 0.42;
      const drift = ctx.createRadialGradient(x, y - 3, 2, x, y, rx);
      drift.addColorStop(0, 'rgba(255,255,255,0.75)');
      drift.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = drift;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sparkle: tiny glints, a few with cross flares.
    for (let i = 0; i < 210; i += 1) {
      const x = GROUND.x + rng.range(4, W - 4);
      const y = GROUND.y + rng.range(4, H - 4);
      ctx.fillStyle = `rgba(255,255,255,${rng.range(0.4, 0.95)})`;
      ctx.beginPath();
      ctx.arc(x, y, rng.range(0.8, 1.6), 0, Math.PI * 2);
      ctx.fill();
      if (rng.chance(0.14)) {
        ctx.strokeStyle = 'rgba(220,240,255,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
        ctx.stroke();
      }
    }
    // Frozen cracks in the earth under the snow.
    ctx.strokeStyle = 'rgba(93,132,166,0.4)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 30; i += 1) {
      let x = GROUND.x + rng.range(10, W - 10);
      let y = GROUND.y + rng.range(10, H - 10);
      let a = rng.range(0, Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 3; s += 1) {
        a += rng.range(-0.6, 0.6);
        x += Math.cos(a) * rng.range(7, 16);
        y += Math.sin(a) * rng.range(7, 16);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}

/** Small worn details along the road itself, per biome. */
function paintRoadTrim(ctx, world) {
  const rng = makeRng(hashSeed(`heliodrome-road-${world.island.name}`));
  const path = world.island.path;
  const total = polylineLength(path);
  const biome = ISLAND_ART[world.islandIndex].biome;
  const count = 130;
  for (let i = 0; i < count; i += 1) {
    const at = pointAlong(path, (i / count) * total + rng.range(-6, 6));
    const side = rng.chance(0.5) ? -1 : 1;
    const off = rng.range(15, 21) * side;
    const x = at.point.x + -at.dir.y * off;
    const y = at.point.y + at.dir.x * off;
    ctx.fillStyle = biome === 'frost' ? 'rgba(255,255,255,0.5)'
      : biome === 'shoals' ? 'rgba(255,140,60,0.35)'
        : 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(x, y, rng.range(1.2, 2.8), 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Stroke a polyline path. */
function strokePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

/** True when a point lies within `pad` px of the island's road. */
function nearPath(island, x, y, pad) {
  for (let i = 1; i < island.path.length; i += 1) {
    const a = island.path[i - 1];
    const b = island.path[i];
    const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1)));
    const dx = x - (a.x + (b.x - a.x) * t);
    const dy = y - (a.y + (b.y - a.y) * t);
    if (dx * dx + dy * dy < pad * pad) return true;
  }
  return false;
}

/** One piece of terrain dressing, drawn to its kind and biome. */
function drawDressing(ctx, item, art) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.spin);
  ctx.scale(item.flip, 1);
  const s = item.size;
  switch (item.kind) {
    case 'grass': {
      ctx.strokeStyle = art.tuft;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.8;
      for (let b = -2; b <= 2; b += 1) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(b * 2.2, -s, b * 3.2, -s * 1.6);
        ctx.stroke();
      }
      break;
    }
    case 'flower': {
      ctx.strokeStyle = art.tuft;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s);
      ctx.stroke();
      ctx.fillStyle = item.shade > 0 ? art.flowerA : art.flowerB;
      ctx.globalAlpha = 0.95;
      for (let p = 0; p < 5; p += 1) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * s * 0.32, -s + Math.sin(a) * s * 0.32, s * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd94e';
      ctx.beginPath();
      ctx.arc(0, -s, s * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'pebble': {
      ctx.fillStyle = art.rock;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.8, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.2, -s * 0.15, s * 0.35, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'shell': {
      ctx.fillStyle = 'rgba(255,240,214,0.65)';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.6, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(190,150,120,0.6)';
      ctx.lineWidth = 1;
      for (let r = -2; r <= 2; r += 1) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * s * 0.22, -s * 0.55);
        ctx.stroke();
      }
      break;
    }
    case 'rock': {
      ctx.fillStyle = art.rock;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.6);
      ctx.lineTo(-s * 0.3, -s * 0.7);
      ctx.lineTo(s * 0.7, -s * 0.2);
      ctx.lineTo(s, s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.7);
      ctx.lineTo(s * 0.7, -s * 0.2);
      ctx.lineTo(s * 0.2, s * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'rune': {
      ctx.strokeStyle = art.accent;
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, 0);
      ctx.lineTo(s * 0.4, 0);
      ctx.moveTo(0, -s * 0.4);
      ctx.lineTo(0, s * 0.4);
      ctx.stroke();
      break;
    }
    case 'crack': {
      ctx.strokeStyle = 'rgba(74,54,32,0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(-s * 0.3, s * 0.3);
      ctx.lineTo(s * 0.4, -s * 0.2);
      ctx.lineTo(s, s * 0.25);
      ctx.stroke();
      break;
    }
    case 'drytuft': {
      ctx.strokeStyle = '#a8843e';
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.7;
      for (let b = -2; b <= 2; b += 1) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(b * 2.6, -s * 0.8, b * 4, -s * 1.3);
        ctx.stroke();
      }
      break;
    }
    case 'bones': {
      ctx.strokeStyle = 'rgba(240,232,210,0.8)';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, -s * 0.5);
      ctx.lineTo(s * 0.8, s * 0.5);
      ctx.moveTo(-s * 0.8, s * 0.5);
      ctx.lineTo(s * 0.8, -s * 0.5);
      ctx.stroke();
      break;
    }
    case 'stone': {
      ctx.fillStyle = art.rock;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.4);
      ctx.lineTo(-s * 0.6, -s * 0.5);
      ctx.lineTo(s * 0.5, -s * 0.6);
      ctx.lineTo(s, s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      break;
    }
    case 'moss': {
      ctx.fillStyle = 'rgba(70,96,64,0.55)';
      for (const [ox, oy, r] of [[0, 0, 0.8], [-0.6, 0.3, 0.5], [0.6, 0.25, 0.55]]) {
        ctx.beginPath();
        ctx.ellipse(ox * s, oy * s, s * r, s * r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'lavarock': {
      ctx.fillStyle = '#241a18';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.5);
      ctx.lineTo(-s * 0.4, -s * 0.6);
      ctx.lineTo(s * 0.6, -s * 0.3);
      ctx.lineTo(s, s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ff7a2a';
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, s * 0.1);
      ctx.lineTo(0, -s * 0.2);
      ctx.lineTo(s * 0.4, s * 0.15);
      ctx.stroke();
      break;
    }
    case 'vent': {
      ctx.fillStyle = '#191314';
      ctx.beginPath();
      ctx.moveTo(-s, s * 0.6);
      ctx.lineTo(-s * 0.35, -s * 0.5);
      ctx.lineTo(s * 0.35, -s * 0.5);
      ctx.lineTo(s, s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff8a3c';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.45, s * 0.3, s * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ash': {
      ctx.fillStyle = 'rgba(205,190,180,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.3, s * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'drift': {
      const g = ctx.createRadialGradient(0, -s * 0.2, 1, 0, 0, s * 1.4);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.4, s * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'iceshard': {
      ctx.fillStyle = 'rgba(190,230,255,0.75)';
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.2);
      ctx.lineTo(s * 0.45, s * 0.4);
      ctx.lineTo(-s * 0.45, s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.2);
      ctx.lineTo(s * 0.45, s * 0.4);
      ctx.lineTo(0, s * 0.4);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'pine': {
      ctx.fillStyle = '#4a3626';
      ctx.fillRect(-1.4, 0, 2.8, s * 0.5);
      ctx.fillStyle = '#2c4a3e';
      for (let tier = 0; tier < 3; tier += 1) {
        const w = s * (1 - tier * 0.24);
        const top = -s * (0.4 + tier * 0.55);
        ctx.beginPath();
        ctx.moveTo(0, top - s * 0.6);
        ctx.lineTo(w * 0.62, top + s * 0.3);
        ctx.lineTo(-w * 0.62, top + s * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(0, -s * 2.05);
      ctx.lineTo(s * 0.2, -s * 1.5);
      ctx.lineTo(-s * 0.2, -s * 1.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/**
 * The living ground: shore foam breathing at the sea's edge, Frostmere's
 * ice in its current melt, and every cloud's shadow lying on the field.
 */
function drawDynamicGround(ctx, world) {
  const art = ISLAND_ART[world.islandIndex];
  // Shore foam: two soft lines along the ground's south rim, breathing.
  if (!world.night && (art.biome === 'coast' || art.biome === 'shoals')) {
    const baseY = GROUND.y + GROUND.height + 12;
    for (let line = 0; line < 2; line += 1) {
      ctx.strokeStyle = art.biome === 'shoals'
        ? `rgba(255,150,80,${0.22 + 0.1 * Math.sin(world.time * 1.4 + line)})`
        : `rgba(240,250,255,${0.3 + 0.12 * Math.sin(world.time * 1.2 + line * 2)})`;
      ctx.lineWidth = 2.4 - line * 0.8;
      ctx.beginPath();
      for (let x = 0; x <= FIELD.width; x += 32) {
        const y = baseY + line * 9 + Math.sin(world.time * 0.9 + x * 0.02 + line) * 3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  if (world.ice) for (const sheet of world.ice) drawIceSheet(ctx, world, sheet);
  // Cloud shadows.
  if (world.weather) {
    for (const cloud of world.weather.clouds) {
      const g = ctx.createRadialGradient(cloud.x, cloud.y, cloud.rx * 0.2, cloud.x, cloud.y, cloud.rx);
      g.addColorStop(0, `rgba(8,8,20,${cloud.dark})`);
      g.addColorStop(0.75, `rgba(8,8,20,${cloud.dark * 0.7})`);
      g.addColorStop(1, 'rgba(8,8,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.rx, cloud.ry * 1.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * One sheet of Frostmere ice in its current state: open water below
 * (dark, rippling), frozen sheet above (pale, cracked, glossy), the
 * balance set by sheet.melt. The melt's edge froths faintly.
 */
function drawIceSheet(ctx, world, sheet) {
  ctx.save();
  ctx.translate(sheet.x, sheet.y);
  // Open water, revealed as the sheet melts.
  if (sheet.melt > 0.02) {
    ctx.globalAlpha = Math.min(1, sheet.melt * 1.15);
    const water = ctx.createRadialGradient(0, 0, 4, 0, 0, sheet.rx);
    water.addColorStop(0, '#3f6d94');
    water.addColorStop(1, '#274b63');
    ctx.fillStyle = water;
    ctx.beginPath();
    ctx.ellipse(0, 0, sheet.rx, sheet.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,245,255,0.5)';
    ctx.lineWidth = 1.4;
    for (let r = 0; r < 3; r += 1) {
      const rr = ((world.time * 14 + r * 30 + sheet.x) % 80) / 80;
      ctx.globalAlpha = (1 - rr) * 0.5 * sheet.melt;
      ctx.beginPath();
      ctx.ellipse(0, 0, sheet.rx * rr, sheet.ry * rr, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // The frozen sheet itself.
  if (sheet.melt < 0.98) {
    ctx.globalAlpha = 1 - sheet.melt * 0.9;
    const ice = ctx.createLinearGradient(-sheet.rx, -sheet.ry, sheet.rx, sheet.ry);
    ice.addColorStop(0, '#e8f6ff');
    ice.addColorStop(0.5, '#b9dcf2');
    ice.addColorStop(1, '#8fb8d8');
    ctx.fillStyle = ice;
    ctx.beginPath();
    ctx.ellipse(0, 0, sheet.rx, sheet.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cracks, seeded by the sheet's position so they never swim.
    const rng = makeRng(Math.floor(sheet.x * 7 + sheet.y * 13));
    ctx.strokeStyle = 'rgba(70,110,150,0.55)';
    ctx.lineWidth = 1.3;
    for (let c = 0; c < 7; c += 1) {
      let px = rng.range(-sheet.rx * 0.5, sheet.rx * 0.5);
      let py = rng.range(-sheet.ry * 0.5, sheet.ry * 0.5);
      let a = rng.range(0, Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let s = 0; s < 4; s += 1) {
        a += rng.range(-0.8, 0.8);
        px += Math.cos(a) * rng.range(9, 22);
        py += Math.sin(a) * rng.range(6, 14);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Gloss: a long soft highlight.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-sheet.rx * 0.25, -sheet.ry * 0.35, sheet.rx * 0.5, sheet.ry * 0.2, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** The Heart Crystal: a faceted gem on a stone plinth, breathing light. */
function drawCrystal(ctx, world) {
  const c = world.island.crystal;
  const pulse = 0.5 + 0.5 * Math.sin(world.time * 2.2);
  const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 66 + pulse * 14);
  glow.addColorStop(0, 'rgba(255,120,160,0.4)');
  glow.addColorStop(1, 'rgba(255,120,160,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3c3644';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 16, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  const w = 15;
  const h = 24 + pulse * 2;
  const grad = ctx.createLinearGradient(c.x - w, c.y - h, c.x + w, c.y + h);
  grad.addColorStop(0, '#ffd3e2');
  grad.addColorStop(0.45, '#ff7ba9');
  grad.addColorStop(1, '#c23a6e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - h);
  ctx.lineTo(c.x + w, c.y - 2);
  ctx.lineTo(c.x + w * 0.55, c.y + h * 0.7);
  ctx.lineTo(c.x - w * 0.55, c.y + h * 0.7);
  ctx.lineTo(c.x - w, c.y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - h);
  ctx.lineTo(c.x, c.y + h * 0.55);
  ctx.moveTo(c.x - w, c.y - 2);
  ctx.lineTo(c.x + w, c.y - 2);
  ctx.stroke();
  const health = world.maxLives ? world.lives / world.maxLives : 0;
  ctx.fillStyle = 'rgba(10,8,14,0.55)';
  roundRect(ctx, c.x - 24, c.y + 30, 48, 6, 3);
  ctx.fill();
  ctx.fillStyle = health > 0.35 ? '#ff8fb5' : '#ff5252';
  roundRect(ctx, c.x - 24, c.y + 30, 48 * clamp(health, 0, 1), 6, 3);
  ctx.fill();
}

/** Build pads: stone circles; hover and affordability are shown. */
function drawPads(ctx, world, input) {
  for (const pad of world.island.pads) {
    if (pad.tower) continue;
    const hover = input && distance(input.mouse, pad) < 24;
    ctx.fillStyle = hover ? 'rgba(255,240,200,0.34)' : 'rgba(20,16,24,0.28)';
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hover ? '#ffe9a8' : 'rgba(255,244,214,0.4)';
    ctx.lineWidth = hover ? 2.4 : 1.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, 21, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (world.buildKind && hover) {
      ctx.fillStyle = 'rgba(255,249,230,0.9)';
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Every standing tower, drawn to its kind, with its level pips. */
function drawTowers(ctx, world) {
  for (const tower of world.towers) {
    ctx.save();
    ctx.translate(tower.x, tower.y);
    // Stone base shared by all glass.
    ctx.fillStyle = 'rgba(24,20,30,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#575064';
    ctx.beginPath();
    ctx.arc(0, 6, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6e6780';
    ctx.beginPath();
    ctx.arc(0, 3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,150,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 3, 10, 0, Math.PI * 2);
    ctx.stroke();
    switch (tower.kind) {
      case 'mirror': drawMirror(ctx, tower, world); break;
      case 'prism': drawPrism(ctx, tower, world); break;
      case 'lens': drawLens(ctx, tower, world); break;
      case 'splitter': drawSplitter(ctx, tower, world); break;
      case 'bell': drawBell(ctx, tower, world); break;
      case 'shard': drawShard(ctx, tower, world); break;
      case 'chrono': drawChrono(ctx, tower, world); break;
      case 'storm': drawStorm(ctx, tower, world); break;
      default: break;
    }
    if (tower.level > 0) {
      ctx.fillStyle = '#ffd98a';
      for (let i = 0; i < tower.level; i += 1) {
        ctx.beginPath();
        ctx.arc(-8 + i * 8, 17, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (world.selected === tower) {
      ctx.strokeStyle = 'rgba(255,233,168,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 27 + Math.sin(world.time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** A mirror: a bright bar of glass in a brass frame, at its angle. */
function drawMirror(ctx, tower, world) {
  ctx.save();
  ctx.rotate(tower.angle);
  ctx.fillStyle = '#8a6a2f';
  roundRect(ctx, -tower.radius - 2.5, -6.4, tower.radius * 2 + 5, 12.8, 5);
  ctx.fill();
  const grad = ctx.createLinearGradient(0, -5, 0, 5);
  grad.addColorStop(0, '#fdfdff');
  grad.addColorStop(0.5, '#b9c9e8');
  grad.addColorStop(1, '#7e93bd');
  ctx.fillStyle = grad;
  roundRect(ctx, -tower.radius, -4.4, tower.radius * 2, 8.8, 4);
  ctx.fill();
  // A glint that travels the glass as the day turns.
  const glint = ((world.time * 0.35 + tower.id * 0.37) % 1) * tower.radius * 2 - tower.radius;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(glint - 1.6, -4.2, 3.2, 8.4);
  ctx.restore();
  ctx.fillStyle = '#2e2a38';
  ctx.beginPath();
  ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

/** A prism: a faceted triangle glowing with the colours it makes. */
function drawPrism(ctx, tower, world) {
  const pulse = 0.78 + 0.22 * Math.sin(world.time * 3 + tower.id);
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(15, 11);
  ctx.lineTo(-15, 11);
  ctx.closePath();
  const grad = ctx.createLinearGradient(-15, 0, 15, 0);
  grad.addColorStop(0, `rgba(255,122,60,${0.88 * pulse})`);
  grad.addColorStop(0.5, `rgba(255,233,168,${0.97 * pulse})`);
  grad.addColorStop(1, `rgba(154,107,255,${0.88 * pulse})`);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -17);
  ctx.lineTo(0, 11);
  ctx.moveTo(-15, 11);
  ctx.lineTo(15, 11);
  ctx.stroke();
}

/** A lens: brass-rimmed concentric glass that brightens as beams pass. */
function drawLens(ctx, tower, world) {
  ctx.strokeStyle = '#8a6a2f';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, -2, 15.5, 0, Math.PI * 2);
  ctx.stroke();
  for (let r = 13; r > 4; r -= 4.4) {
    ctx.strokeStyle = `rgba(190,225,255,${0.4 + (13 - r) * 0.05})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const glow = 0.6 + 0.4 * Math.sin(world.time * 2.4 + tower.id * 2);
  ctx.fillStyle = `rgba(225,244,255,${glow})`;
  ctx.beginPath();
  ctx.arc(0, -2, 3.6, 0, Math.PI * 2);
  ctx.fill();
}

/** A splitter: a Y of glass — stem down, two arms up, orbs at the tips. */
function drawSplitter(ctx) {
  ctx.strokeStyle = '#dfe9ff';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, -2);
  ctx.moveTo(0, -2);
  ctx.lineTo(-10, -14);
  ctx.moveTo(0, -2);
  ctx.lineTo(10, -14);
  ctx.stroke();
  ctx.fillStyle = '#fff6d8';
  for (const [x, y] of [[0, 12], [-10, -14], [10, -14], [0, -2]]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A dawn bell: brass, with a clapper that swings as its ring nears. */
function drawBell(ctx, tower, world) {
  const swing = Math.sin(world.time * 2.4 + tower.id) * (tower.timer < 2 ? 0.4 : 0.08);
  ctx.fillStyle = '#8a6a2f';
  ctx.fillRect(-2, -18, 4, 6);
  const grad = ctx.createLinearGradient(-12, -12, 12, 12);
  grad.addColorStop(0, '#ffe9a0');
  grad.addColorStop(0.55, '#d9a83f');
  grad.addColorStop(1, '#9a742a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.quadraticCurveTo(11, -12, 12, 4);
  ctx.quadraticCurveTo(12, 10, 15, 12);
  ctx.lineTo(-15, 12);
  ctx.quadraticCurveTo(-12, 10, -12, 4);
  ctx.quadraticCurveTo(-11, -12, 0, -13);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,69,26,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-11, 6);
  ctx.quadraticCurveTo(0, 9, 11, 6);
  ctx.stroke();
  ctx.save();
  ctx.rotate(swing);
  ctx.fillStyle = '#5d451a';
  ctx.beginPath();
  ctx.arc(0, 13, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** An eclipse shard: black glass that fills with stolen sunlight. */
function drawShard(ctx, tower) {
  const charge = tower.charge || 0;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(9, 2);
  ctx.lineTo(4, 14);
  ctx.lineTo(-5, 14);
  ctx.lineTo(-10, -2);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, -18, 0, 14);
  grad.addColorStop(0, '#241d33');
  grad.addColorStop(1, '#0d0a16');
  ctx.fillStyle = grad;
  ctx.fill();
  if (charge > 0.02) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = `rgba(255,196,80,${0.35 + charge * 0.6})`;
    const h = 32 * charge;
    ctx.fillRect(-11, 14 - h, 22, h);
    ctx.restore();
  }
  ctx.strokeStyle = charge >= 1 ? '#ffd98a' : '#4a4066';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(9, 2);
  ctx.lineTo(4, 14);
  ctx.lineTo(-5, 14);
  ctx.lineTo(-10, -2);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(201,184,255,0.8)';
  ctx.font = '7px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✦', 0, 6);
  ctx.textAlign = 'left';
}

/** A chrono lens: an hourglass of cyan glass, its sand running upward. */
function drawChrono(ctx, tower, world) {
  ctx.fillStyle = '#8a6a2f';
  roundRect(ctx, -10, -17, 20, 3.6, 1.8);
  ctx.fill();
  roundRect(ctx, -10, 13, 20, 3.6, 1.8);
  ctx.fill();
  const pulse = 0.7 + 0.3 * Math.sin(world.time * 2.6 + tower.id);
  const grad = ctx.createLinearGradient(0, -14, 0, 14);
  grad.addColorStop(0, `rgba(103,232,249,${0.5 * pulse})`);
  grad.addColorStop(0.5, 'rgba(224,251,255,0.25)');
  grad.addColorStop(1, `rgba(103,232,249,${0.5 * pulse})`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-8, -14);
  ctx.lineTo(8, -14);
  ctx.lineTo(1.6, 0);
  ctx.lineTo(8, 14);
  ctx.lineTo(-8, 14);
  ctx.lineTo(-1.6, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(224,251,255,0.8)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Sand grains, rising through the pinch against time.
  ctx.fillStyle = '#a5f3fc';
  for (let i = 0; i < 3; i += 1) {
    const k = ((world.time * 0.5 + tower.id * 0.31 + i / 3) % 1);
    const y = 11 - k * 22;
    const spread = Math.abs(y) * 0.32;
    ctx.beginPath();
    ctx.arc(Math.sin(i * 7.3) * spread * 0.5, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A storm prism: a prism on a spire, sparks orbiting, hungry for sky. */
function drawStorm(ctx, tower, world) {
  // The spire.
  ctx.fillStyle = '#4a4358';
  ctx.beginPath();
  ctx.moveTo(-6, 12);
  ctx.lineTo(-3, -6);
  ctx.lineTo(3, -6);
  ctx.lineTo(6, 12);
  ctx.closePath();
  ctx.fill();
  // The prism, riding higher than a ground prism and burning brighter.
  ctx.save();
  ctx.translate(0, -12);
  const pulse = 0.8 + 0.2 * Math.sin(world.time * 3.6 + tower.id);
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(12, 8);
  ctx.lineTo(-12, 8);
  ctx.closePath();
  const grad = ctx.createLinearGradient(-12, 0, 12, 0);
  grad.addColorStop(0, `rgba(255,170,60,${0.9 * pulse})`);
  grad.addColorStop(0.5, `rgba(255,246,216,${0.98 * pulse})`);
  grad.addColorStop(1, `rgba(140,160,255,${0.9 * pulse})`);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();
  // Orbiting sparks.
  ctx.fillStyle = '#cfe4ff';
  for (let i = 0; i < 3; i += 1) {
    const a = world.time * 2.2 + tower.id + (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 17, -8 + Math.sin(a) * 6, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A tiny iconic glyph of a tower kind, for the build-bar cards. */
export function drawTowerIcon(ctx, kind, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 40, s / 40);
  ctx.lineWidth = 2.6;
  switch (kind) {
    case 'mirror':
      ctx.strokeStyle = '#dfe9ff';
      ctx.beginPath();
      ctx.moveTo(-13, 8);
      ctx.lineTo(13, -8);
      ctx.stroke();
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'prism': {
      const g = ctx.createLinearGradient(-12, 0, 12, 0);
      g.addColorStop(0, '#ff7a3c');
      g.addColorStop(0.5, '#ffe9a8');
      g.addColorStop(1, '#9a6bff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(12, 10);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'lens':
      ctx.strokeStyle = '#bfe3ff';
      for (const r of [12, 7]) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'splitter':
      ctx.strokeStyle = '#dfe9ff';
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(0, -2);
      ctx.moveTo(0, -2);
      ctx.lineTo(-9, -12);
      ctx.moveTo(0, -2);
      ctx.lineTo(9, -12);
      ctx.stroke();
      break;
    case 'bell':
      ctx.fillStyle = '#e9bc55';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.quadraticCurveTo(10, -10, 10, 4);
      ctx.quadraticCurveTo(10, 9, 13, 11);
      ctx.lineTo(-13, 11);
      ctx.quadraticCurveTo(-10, 9, -10, 4);
      ctx.quadraticCurveTo(-10, -10, 0, -12);
      ctx.fill();
      break;
    case 'shard':
      ctx.fillStyle = '#241d33';
      ctx.strokeStyle = '#8f86a8';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(8, 2);
      ctx.lineTo(3, 12);
      ctx.lineTo(-4, 12);
      ctx.lineTo(-8, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'chrono':
      ctx.strokeStyle = '#67e8f9';
      ctx.beginPath();
      ctx.moveTo(-8, -12);
      ctx.lineTo(8, -12);
      ctx.lineTo(2, 0);
      ctx.lineTo(8, 12);
      ctx.lineTo(-8, 12);
      ctx.lineTo(-2, 0);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'storm':
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(11, 6);
      ctx.lineTo(-11, 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#7fb0ff';
      ctx.beginPath();
      ctx.moveTo(3, 6);
      ctx.lineTo(-3, 15);
      ctx.lineTo(1, 15);
      ctx.lineTo(-2, 22);
      ctx.lineTo(6, 12);
      ctx.lineTo(2, 12);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      break;
  }
  ctx.restore();
}

/** The beam itself: three additive passes — halo, body, core. */
function drawBeams(ctx, world) {
  const { segments, glows } = world.beams;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const passes = [
    { width: 15, alpha: 0.10 },
    { width: 7, alpha: 0.22 },
    { width: 2.6, alpha: 0.85 },
  ];
  for (const pass of passes) {
    for (const seg of segments) {
      const spec = SPECTRUM[seg.colour];
      ctx.strokeStyle = pass.width < 3 ? spec.core : spec.css;
      ctx.globalAlpha = pass.alpha * Math.min(1, 0.35 + seg.power * 0.75);
      ctx.lineWidth = pass.width * (1 + 0.2 * world.tree.wideBeam) * (0.7 + Math.min(0.6, seg.power * 0.3));
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (const glow of glows) {
    const spec = SPECTRUM[glow.colour];
    const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, 15);
    g.addColorStop(0, spec.core);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(glow.x, glow.y, 15, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The Eclipse's shadow disc: a black coin with a burning rim. */
function drawEclipseDisc(ctx, world) {
  const disc = world.eclipseDisc;
  if (!disc) return;
  const grad = ctx.createRadialGradient(disc.x, disc.y, disc.radius * 0.55, disc.x, disc.y, disc.radius * 1.25);
  grad.addColorStop(0, 'rgba(4,3,10,0.97)');
  grad.addColorStop(0.72, 'rgba(4,3,10,0.94)');
  grad.addColorStop(0.85, 'rgba(30,16,54,0.55)');
  grad.addColorStop(1, 'rgba(30,16,54,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(disc.x, disc.y, disc.radius * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,150,80,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(disc.x, disc.y, disc.radius * 0.86, 0, Math.PI * 2);
  ctx.stroke();
}

/** Transient effects: bell rings, shard lances, storm bolts, crystal strikes. */
function drawEffects(ctx, world) {
  for (const effect of world.effects) {
    const k = effect.t / effect.ttl;
    if (effect.kind === 'ring') {
      ctx.strokeStyle = `rgba(255,220,140,${0.7 * (1 - k)})`;
      ctx.lineWidth = 3.4 * (1 - k) + 0.6;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius + k * 260, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === 'lance') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,214,130,${0.9 * (1 - k)})`;
      ctx.lineWidth = 7 * (1 - k) + 1;
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,240,${0.95 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
      ctx.restore();
    } else if (effect.kind === 'zap') {
      // Chain lightning: a jagged polyline, redrawn with fresh jitter
      // each frame so it crawls while it lives.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [width, colour, alpha] of [[5, '#7fb0ff', 0.5], [2, '#eaf4ff', 0.95]]) {
        ctx.strokeStyle = colour;
        ctx.globalAlpha = alpha * (1 - k);
        ctx.lineWidth = width;
        ctx.beginPath();
        effect.points.forEach((p, i) => {
          if (i === 0) {
            ctx.moveTo(p.x, p.y);
            return;
          }
          const prev = effect.points[i - 1];
          const mx = (prev.x + p.x) / 2 + (Math.random() - 0.5) * 16;
          const my = (prev.y + p.y) / 2 + (Math.random() - 0.5) * 16;
          ctx.lineTo(mx, my);
          ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    } else if (effect.kind === 'crystalHit') {
      ctx.strokeStyle = `rgba(255,90,120,${0.85 * (1 - k)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius + k * 46, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** All live particles, additive. */
function drawParticles(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of world.particles.list) {
    const life = 1 - p.t / p.ttl;
    ctx.globalAlpha = life * 0.9;
    ctx.fillStyle = p.colour;
    const size = p.shrink ? p.size * life + 0.4 : p.size;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Shades, each kind with its own silhouette; health bars when hurt. */
function drawEnemies(ctx, world) {
  const sorted = [...world.enemies].sort((a, b) => a.y - b.y);
  for (const enemy of sorted) {
    if (!enemy.alive) continue;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = 'rgba(8,6,14,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, enemy.radius * 0.8, enemy.radius * 0.9, enemy.radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    switch (enemy.kind) {
      case 'moth': drawMoth(ctx, enemy, world); break;
      case 'crawler': drawCrawler(ctx, enemy, world); break;
      case 'wraith': drawWraith(ctx, enemy, world); break;
      case 'beetle': drawBeetle(ctx, enemy, world); break;
      case 'swift': drawSwift(ctx, enemy, world); break;
      case 'shade': drawShade(ctx, enemy, world); break;
      case 'splitterbug': drawHusk(ctx, enemy, world); break;
      case 'veil': drawVeil(ctx, enemy, world); break;
      case 'burrower': drawBurrower(ctx, enemy, world); break;
      case 'colossus': drawColossus(ctx, enemy, world); break;
      case 'dreadnought': drawDreadnought(ctx, enemy, world); break;
      case 'eclipse': drawEclipse(ctx, enemy, world); break;
      default: break;
    }
    ctx.restore();
    // Status tells: a lit halo, a flame for burning, a violet ring for slow.
    if (enemy.lit && enemy.surfaced) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,190,90,0.20)';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius * 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (enemy.burn > 0.6 && enemy.surfaced) {
      const f = 3 + Math.sin(world.time * 17 + enemy.wobble * 4) * 1.2;
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y - enemy.radius - 4 - f);
      ctx.quadraticCurveTo(enemy.x + 3.4, enemy.y - enemy.radius + 1, enemy.x, enemy.y - enemy.radius + 3.4);
      ctx.quadraticCurveTo(enemy.x - 3.4, enemy.y - enemy.radius + 1, enemy.x, enemy.y - enemy.radius - 4 - f);
      ctx.fill();
    }
    if (enemy.hp < enemy.maxHp && enemy.surfaced) {
      const w = Math.max(22, enemy.radius * 1.7);
      ctx.fillStyle = 'rgba(8,6,12,0.6)';
      roundRect(ctx, enemy.x - w / 2, enemy.y - enemy.radius - 11, w, 4.4, 2);
      ctx.fill();
      ctx.fillStyle = enemy.slowFactor > 0 ? '#9a6bff' : '#ffcf5c';
      roundRect(ctx, enemy.x - w / 2, enemy.y - enemy.radius - 11, w * clamp(enemy.hp / enemy.maxHp, 0, 1), 4.4, 2);
      ctx.fill();
    }
  }
}

/** Duskmoth: two wings that beat, a body of soot, eyes like pins. */
function drawMoth(ctx, enemy, world) {
  const beat = Math.sin(world.time * 16 + enemy.wobble * 5) * 0.55;
  ctx.fillStyle = '#4a4258';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(-0.5 - beat * side * 0.4);
    ctx.beginPath();
    ctx.ellipse(9, -3, 10, 5.4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(201,184,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(10, -4, 5, 2.4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#4a4258';
  }
  ctx.fillStyle = '#241f30';
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.6, 7.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9b8ff';
  ctx.beginPath();
  ctx.arc(-1.8, -4.4, 1.1, 0, Math.PI * 2);
  ctx.arc(1.8, -4.4, 1.1, 0, Math.PI * 2);
  ctx.fill();
}

/** Gloomcrawler: armoured segments that ripple as it walks. */
function drawCrawler(ctx, enemy, world) {
  const dir = enemy.dir || { x: 1, y: 0 };
  ctx.rotate(Math.atan2(dir.y, dir.x));
  for (let i = 3; i >= 0; i -= 1) {
    const off = -i * 8;
    const lift = Math.sin(world.time * 7 + enemy.wobble + i) * 1.6;
    ctx.fillStyle = i % 2 ? '#332c44' : '#3e3552';
    ctx.beginPath();
    ctx.arc(off, lift * 0.3, 8.4 - i * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,120,180,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(off, lift * 0.3, 8.4 - i * 0.7, Math.PI * 0.9, Math.PI * 1.6);
    ctx.stroke();
  }
  ctx.fillStyle = '#57496e';
  ctx.beginPath();
  ctx.arc(4, 0, 6.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb0a0';
  ctx.beginPath();
  ctx.arc(6.4, -2.4, 1.3, 0, Math.PI * 2);
  ctx.arc(6.4, 2.4, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Pale Wraith: a translucent ghost with a trailing, tattered hem. */
function drawWraith(ctx, enemy, world) {
  const sway = Math.sin(world.time * 3.4 + enemy.wobble) * 2;
  ctx.save();
  ctx.translate(sway * 0.4, Math.sin(world.time * 2.2 + enemy.wobble) * 2.4);
  const grad = ctx.createLinearGradient(0, -14, 0, 14);
  grad.addColorStop(0, 'rgba(216,228,255,0.95)');
  grad.addColorStop(1, 'rgba(160,170,220,0.22)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.quadraticCurveTo(10, -10, 9, 2);
  ctx.quadraticCurveTo(12, 12, 6, 10);
  ctx.quadraticCurveTo(3, 15, 1, 10);
  ctx.quadraticCurveTo(-1, 15, -4, 10);
  ctx.quadraticCurveTo(-12, 12, -9, 2);
  ctx.quadraticCurveTo(-10, -10, 0, -13);
  ctx.fill();
  ctx.fillStyle = '#141126';
  ctx.beginPath();
  ctx.arc(-3.4, -4, 1.7, 0, Math.PI * 2);
  ctx.arc(3.4, -4, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 1.4, 2.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Umbral Beetle: a dome of chitin with a horn and a lit seam. */
function drawBeetle(ctx, enemy) {
  const grad = ctx.createRadialGradient(-4, -6, 2, 0, 0, 19);
  grad.addColorStop(0, '#4e4470');
  grad.addColorStop(1, '#1d1830');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#120e20';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, 12);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(150,130,200,0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 7.6, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.strokeStyle = '#6a5a94';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(10, -4);
  ctx.quadraticCurveTo(18, -8, 20, -14);
  ctx.stroke();
  ctx.fillStyle = '#c9b8ff';
  ctx.beginPath();
  ctx.arc(8, -1, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Nightswift: a dart of shadow, motion-blurred behind itself. */
function drawSwift(ctx, enemy) {
  const dir = enemy.dir || { x: 1, y: 0 };
  ctx.rotate(Math.atan2(dir.y, dir.x));
  ctx.fillStyle = 'rgba(30,26,48,0.5)';
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  const grad = ctx.createLinearGradient(-8, 0, 12, 0);
  grad.addColorStop(0, '#2c2544');
  grad.addColorStop(1, '#57496e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd2a0';
  ctx.beginPath();
  ctx.arc(5, 0, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Greater Shade: a tall figure of smoke with ember eyes. */
function drawShade(ctx, enemy, world) {
  const flicker = Math.sin(world.time * 5 + enemy.wobble * 3) * 1.6;
  const grad = ctx.createLinearGradient(0, -22, 0, 20);
  grad.addColorStop(0, '#17122a');
  grad.addColorStop(1, 'rgba(23,18,42,0.35)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -21);
  ctx.quadraticCurveTo(13, -14, 11 + flicker, 6);
  ctx.quadraticCurveTo(13, 18, 5, 15);
  ctx.quadraticCurveTo(0, 20, -5, 15);
  ctx.quadraticCurveTo(-13, 18, -11 + flicker, 6);
  ctx.quadraticCurveTo(-13, -14, 0, -21);
  ctx.fill();
  ctx.fillStyle = '#ff9a5c';
  ctx.beginPath();
  ctx.arc(-4, -9, 1.9, 0, Math.PI * 2);
  ctx.arc(4, -9, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,154,92,0.5)';
  ctx.fillRect(-5, 2, 10, 1.8);
}

/** Mitosis Husk: two fused spheres that pulse against each other. */
function drawHusk(ctx, enemy, world) {
  const pulse = 1 + Math.sin(world.time * 6 + enemy.wobble) * 0.08;
  ctx.fillStyle = '#3a3153';
  ctx.beginPath();
  ctx.arc(-6 * pulse, 0, 10.4, 0, Math.PI * 2);
  ctx.arc(6 * pulse, 0, 10.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#584a7a';
  ctx.beginPath();
  ctx.arc(-6 * pulse, -2, 5.4, 0, Math.PI * 2);
  ctx.arc(6 * pulse, -2, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f0c1c';
  ctx.beginPath();
  ctx.arc(-6 * pulse, -2, 2, 0, Math.PI * 2);
  ctx.arc(6 * pulse, -2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(201,184,255,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -8 * pulse);
  ctx.lineTo(0, 8 * pulse);
  ctx.stroke();
}

/** Veilspinner: a spider of shade under a shimmering woven veil. */
function drawVeil(ctx, enemy, world) {
  ctx.strokeStyle = '#241f36';
  ctx.lineWidth = 2.2;
  for (let leg = 0; leg < 4; leg += 1) {
    const a = (leg / 4) * Math.PI - 0.4 + Math.sin(world.time * 8 + leg * 2) * 0.14;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 14 * side, Math.sin(a) * 10 + 6);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#2c2547';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9.4, 7.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (enemy.veiled) {
    ctx.strokeStyle = `rgba(190,200,255,${0.5 + 0.3 * Math.sin(world.time * 9)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -2, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(190,200,255,${0.3 + 0.2 * Math.sin(world.time * 9 + 1)})`;
    ctx.beginPath();
    ctx.arc(0, -2, 11, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#e2d4ff';
  ctx.beginPath();
  ctx.arc(-3, -2, 1.4, 0, Math.PI * 2);
  ctx.arc(3, -2, 1.4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Deepburrower: a mole of shade with digging claws — or, when it is
 * down, just the mound it travels in, trembling as it nears the light.
 */
function drawBurrower(ctx, enemy, world) {
  if (!enemy.surfaced) {
    const tremble = Math.sin(world.time * 22 + enemy.wobble * 6) * 0.8;
    ctx.fillStyle = '#2e2622';
    ctx.beginPath();
    ctx.ellipse(tremble * 0.3, 2, 15, 8, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#453832';
    ctx.beginPath();
    ctx.ellipse(tremble * 0.3, 1, 10, 5.6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5d4c42';
    for (const [ox, oy, r] of [[-6, -2, 2.2], [3, -4, 1.7], [7, -1, 1.4]]) {
      ctx.beginPath();
      ctx.arc(ox + tremble, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const dir = enemy.dir || { x: 1, y: 0 };
  ctx.rotate(Math.atan2(dir.y, dir.x) * 0.4);
  const grad = ctx.createRadialGradient(-3, -4, 2, 0, 0, 15);
  grad.addColorStop(0, '#4c3a34');
  grad.addColorStop(1, '#241a18');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  // Claws, mid-dig.
  ctx.strokeStyle = '#d8cfc0';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(9, side * 5);
    ctx.lineTo(15, side * 8);
    ctx.moveTo(10, side * 2);
    ctx.lineTo(16, side * 3);
    ctx.stroke();
  }
  // A nose of packed earth and two bead eyes.
  ctx.fillStyle = '#6e5648';
  ctx.beginPath();
  ctx.arc(11, 0, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb0a0';
  ctx.beginPath();
  ctx.arc(4, -4, 1.5, 0, Math.PI * 2);
  ctx.arc(4, 4, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // The dirt ring it burst through.
  ctx.strokeStyle = 'rgba(46,38,34,0.7)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(0, 6, 14, 4.6, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Gloom Colossus: a walking hill of rock and soot. */
function drawColossus(ctx, enemy, world) {
  const bob = Math.sin(world.time * 2.6 + enemy.wobble) * 1.4;
  ctx.save();
  ctx.translate(0, bob);
  const grad = ctx.createLinearGradient(0, -26, 0, 24);
  grad.addColorStop(0, '#3c3355');
  grad.addColorStop(1, '#171226');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-20, 20);
  ctx.lineTo(-16, -8);
  ctx.lineTo(-7, -22);
  ctx.lineTo(8, -24);
  ctx.lineTo(17, -8);
  ctx.lineTo(20, 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,120,180,0.4)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-12, 4);
  ctx.lineTo(-4, -12);
  ctx.moveTo(4, -16);
  ctx.lineTo(10, 2);
  ctx.stroke();
  ctx.fillStyle = '#ff7a3c';
  ctx.beginPath();
  ctx.arc(-5, -10, 2.4, 0, Math.PI * 2);
  ctx.arc(6, -10, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,150,80,0.75)';
  ctx.fillRect(-7, 2, 15, 2.4);
  ctx.restore();
}

/**
 * Dreadnought Shade: a fortress that walks — overlapping plates of
 * woven shade with rivets, a furnace core showing through the seams.
 */
function drawDreadnought(ctx, enemy, world) {
  const bob = Math.sin(world.time * 2 + enemy.wobble) * 1.2;
  ctx.save();
  ctx.translate(0, bob);
  // Furnace glow behind the plates.
  const core = ctx.createRadialGradient(0, 2, 2, 0, 2, 26);
  core.addColorStop(0, 'rgba(255,110,50,0.85)');
  core.addColorStop(0.6, 'rgba(180,50,60,0.4)');
  core.addColorStop(1, 'rgba(120,30,60,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 2, 26, 0, Math.PI * 2);
  ctx.fill();
  // Plates: three overlapping rows of dark armour.
  const plate = (x, y, w, h, tone) => {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - h / 2 + 3);
    ctx.lineTo(x - w / 2 + 3, y - h / 2);
    ctx.lineTo(x + w / 2 - 3, y - h / 2);
    ctx.lineTo(x + w / 2, y - h / 2 + 3);
    ctx.lineTo(x + w / 2, y + h / 2 - 3);
    ctx.lineTo(x + w / 2 - 3, y + h / 2);
    ctx.lineTo(x - w / 2 + 3, y + h / 2);
    ctx.lineTo(x - w / 2, y + h / 2 - 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,140,200,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(220,210,255,0.5)';
    for (const [rx, ry] of [[-w / 2 + 4, -h / 2 + 4], [w / 2 - 4, -h / 2 + 4], [-w / 2 + 4, h / 2 - 4], [w / 2 - 4, h / 2 - 4]]) {
      ctx.beginPath();
      ctx.arc(x + rx, y + ry, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  plate(0, -16, 34, 16, '#241d38');
  plate(-11, 0, 24, 18, '#2c2344');
  plate(11, 0, 24, 18, '#2c2344');
  plate(0, 15, 30, 14, '#1d1830');
  // The visor slit and its eyes.
  ctx.fillStyle = '#0a0616';
  ctx.fillRect(-12, -20, 24, 5);
  ctx.fillStyle = '#ff5a3c';
  ctx.beginPath();
  ctx.arc(-5, -17.5, 1.9, 0, Math.PI * 2);
  ctx.arc(5, -17.5, 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** THE ECLIPSE: a crowned void, the largest thing on the field. */
function drawEclipse(ctx, enemy, world) {
  const pulse = 1 + Math.sin(world.time * 1.8) * 0.03;
  ctx.save();
  ctx.scale(pulse, pulse);
  const corona = ctx.createRadialGradient(0, 0, 26, 0, 0, 54);
  corona.addColorStop(0, 'rgba(255,120,60,0.5)');
  corona.addColorStop(0.6, 'rgba(160,60,160,0.22)');
  corona.addColorStop(1, 'rgba(120,40,160,0)');
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(0, 0, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#05030c';
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,90,0.85)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();
  // Crown spikes.
  ctx.fillStyle = '#0a0616';
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + world.time * 0.24;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(28, -4);
    ctx.lineTo(44, 0);
    ctx.lineTo(28, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#ffb37a';
  ctx.beginPath();
  ctx.arc(-8, -3, 2.6, 0, Math.PI * 2);
  ctx.arc(8, -3, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A soft vignette and a thin gilt frame around the ground. */
function drawVignette(ctx, world) {
  const g = ctx.createRadialGradient(640, 420, 320, 640, 420, 780);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(4,3,10,0.30)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.strokeStyle = 'rgba(255,217,138,0.20)';
  ctx.lineWidth = 1.6;
  roundRect(ctx, GROUND.x - 8, GROUND.y - 8, GROUND.width + 16, GROUND.height + 16, 26);
  ctx.stroke();
  void world;
}

/** The top HUD: wave, island, gold, lives, score, and the sun dial. */
function drawHud(ctx, world, input) {
  ctx.fillStyle = 'rgba(10,9,18,0.74)';
  ctx.fillRect(0, 0, FIELD.width, 46);
  ctx.fillStyle = 'rgba(255,220,150,0.25)';
  ctx.fillRect(0, 46, FIELD.width, 1.4);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 19px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('HELIODROME', 18, 24);

  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = '#f4ecd8';
  const phase = world.director.phase;
  const waveLabel = world.screen === 'play'
    ? (phase === 'build' || phase === 'cleared' ? `Next: Wave ${world.wave}` : `Wave ${world.wave}`)
    : `Wave ${Math.max(1, world.wave)}`;
  ctx.fillText(waveLabel, 190, 24);
  ctx.fillStyle = world.night ? '#bcd3ff' : '#ffd98a';
  ctx.fillText(world.island.name + (world.night ? ' · Night' : ''), 316, 24);

  drawStat(ctx, 520, 'Gold', `${world.gold}`, '#ffd94e');
  drawStat(ctx, 624, 'Lives', `${world.lives}`, '#ff8fb5');
  drawStat(ctx, 724, 'Score', `${world.score}`, '#bfe3ff');
  const left = world.director.totalToSpawn - world.director.spawned + world.enemies.filter((e) => e.alive).length;
  drawStat(ctx, 848, 'Shades', `${Math.max(0, left)}`, '#c9b8ff');

  drawIslandPips(ctx, world, 972, 24);
  drawSunDial(ctx, world, 1064, 23);
  registerButton(ctx, world, 1120, 9, 66, 28, world.paused ? 'Resume' : 'Pause', 'pause', input, world.paused);
  registerButton(ctx, world, 1194, 9, 34, 28, `${world.speed}×`, 'speed', input, false);
  registerButton(ctx, world, 1236, 9, 30, 28, world.audio?.muted ? '✕' : '♪', 'mute', input, false);

  // Weather warning: the sky is eating the sun.
  const cover = sunCover(world);
  if (world.screen === 'play' && cover > 0.55 && !world.night) {
    const blink = 0.65 + 0.35 * Math.sin(world.time * 5);
    ctx.fillStyle = `rgba(160,200,235,${blink})`;
    ctx.font = '700 12.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('☁ THE SUN IS COVERED — THE BEAM STARVES', FIELD.width / 2, 60);
    ctx.textAlign = 'left';
  }
}

/** One HUD stat: small label over a bright value. */
function drawStat(ctx, x, label, value, colour) {
  ctx.textAlign = 'left';
  ctx.font = '600 9.5px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(240,235,220,0.55)';
  ctx.fillText(label.toUpperCase(), x, 14);
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillStyle = colour;
  ctx.fillText(value, x, 31);
}

/** Five island pips: cleared gold, current lit, locked dim. */
function drawIslandPips(ctx, world, cx, cy) {
  for (let i = 0; i < 5; i += 1) {
    const x = cx + i * 17;
    const record = world.save?.islands[i];
    ctx.beginPath();
    ctx.arc(x, cy, 5.4, 0, Math.PI * 2);
    if (record?.cleared) ctx.fillStyle = '#ffd94e';
    else if (i === world.islandIndex) ctx.fillStyle = '#fff6d8';
    else if (record?.unlocked) ctx.fillStyle = 'rgba(244,236,216,0.45)';
    else ctx.fillStyle = 'rgba(244,236,216,0.18)';
    ctx.fill();
    if (i === world.islandIndex) {
      ctx.strokeStyle = 'rgba(255,233,168,0.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, cy, 8.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** The sun dial: an arc the sun crosses; a dot rides it. */
function drawSunDial(ctx, world, cx, cy) {
  ctx.strokeStyle = 'rgba(255,233,168,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy + 12, 15, Math.PI, Math.PI * 2);
  ctx.stroke();
  const p = world.sun.phase;
  const a = Math.PI + p * Math.PI;
  const x = cx + Math.cos(a) * 15;
  const y = cy + 12 + Math.sin(a) * 15;
  ctx.fillStyle = world.night ? '#bcd3ff' : '#ffd94e';
  ctx.beginPath();
  ctx.arc(x, y, 3.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Achievement toasts: small gilt cards sliding under the HUD. */
function drawToasts(ctx, world) {
  let y = 56;
  for (const toast of world.toasts) {
    const fadeIn = Math.min(1, toast.t * 5);
    const fadeOut = toast.t > toast.ttl - 0.6 ? Math.max(0, (toast.ttl - toast.t) / 0.6) : 1;
    ctx.save();
    ctx.globalAlpha = fadeIn * fadeOut;
    const w = 340;
    const x = FIELD.width / 2 - w / 2;
    ctx.fillStyle = 'rgba(22,18,36,0.92)';
    roundRect(ctx, x, y, w, 46, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,78,0.8)';
    ctx.lineWidth = 1.4;
    roundRect(ctx, x, y, w, 46, 10);
    ctx.stroke();
    ctx.fillStyle = '#ffd94e';
    ctx.font = '17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(toast.icon, x + 28, y + 24);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '700 13.5px system-ui, sans-serif';
    ctx.fillText(`Achievement — ${toast.title}`, x + 50, y + 18);
    ctx.fillStyle = 'rgba(244,236,216,0.8)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(toast.sub, x + 50, y + 35);
    ctx.restore();
    y += 54;
  }
}

/** A HUD/build button; registers its hit region as a side effect. */
export function registerButton(ctx, world, x, y, w, h, label, action, input, active, data) {
  const hover = input && input.mouse.x >= x && input.mouse.x <= x + w && input.mouse.y >= y && input.mouse.y <= y + h;
  ctx.fillStyle = active ? 'rgba(255,201,60,0.85)' : hover ? 'rgba(70,60,90,0.92)' : 'rgba(38,34,54,0.9)';
  roundRect(ctx, x, y, w, h, 7);
  ctx.fill();
  ctx.strokeStyle = active ? '#ffe9a8' : 'rgba(255,240,200,0.35)';
  ctx.lineWidth = 1.2;
  roundRect(ctx, x, y, w, h, 7);
  ctx.stroke();
  ctx.fillStyle = active ? '#241a08' : '#f4ecd8';
  ctx.font = '600 12.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
  ctx.textAlign = 'left';
  world.uiRegions.push({ x, y, w, h, action, data });
  return hover;
}

/** The bottom build bar: eight tower cards, selection panel, call-wave. */
function drawBuildBar(ctx, world, input) {
  const y = FIELD.height - BAR_HEIGHT;
  ctx.fillStyle = 'rgba(10,9,18,0.78)';
  ctx.fillRect(0, y, FIELD.width, BAR_HEIGHT);
  ctx.fillStyle = 'rgba(255,220,150,0.25)';
  ctx.fillRect(0, y, FIELD.width, 1.4);
  if (world.screen !== 'play') return;

  let x = 14;
  for (const [kind, spec] of Object.entries(TOWERS)) {
    const cost = Math.round(spec.cost * (1 - 0.08 * world.tree.swiftHands));
    const afford = world.gold >= cost;
    const selected = world.buildKind === kind;
    ctx.fillStyle = selected ? 'rgba(255,201,60,0.9)' : afford ? 'rgba(44,40,64,0.95)' : 'rgba(30,28,42,0.8)';
    roundRect(ctx, x, y + 10, 86, 66, 9);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffe9a8' : 'rgba(255,240,200,0.3)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, x, y + 10, 86, 66, 9);
    ctx.stroke();
    drawTowerIcon(ctx, kind, x + 43, y + 30, 30);
    ctx.fillStyle = selected ? '#241a08' : '#f4ecd8';
    ctx.font = '700 10.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(spec.name, x + 43, y + 55);
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillStyle = selected ? '#5d451a' : afford ? '#ffd94e' : '#8a8296';
    ctx.fillText(`${cost}g · ${spec.key}`, x + 43, y + 68);
    ctx.textAlign = 'left';
    world.uiRegions.push({ x, y: y + 10, w: 86, h: 66, action: 'buildKind', data: kind });
    x += 92;
  }

  drawSelectionPanel(ctx, world, input, x + 6, y);

  const phase = world.director.phase;
  if (phase === 'build' || phase === 'cleared') {
    registerButton(ctx, world, 1104, y + 16, 160, 56, world.wave <= 1 && phase === 'build' ? '▶  Call Wave 1' : `▶  Call Wave ${world.wave}`, 'callWave', input, true);
  } else {
    ctx.fillStyle = 'rgba(240,235,220,0.6)';
    ctx.font = '600 12.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(phase === 'spawning' ? 'The shades are coming…' : 'The shades are on the road…', 1184, y + 44);
    ctx.textAlign = 'left';
  }
}

/** Info and actions for the selected tower (or a hint when none). */
function drawSelectionPanel(ctx, world, input, x, y) {
  const tower = world.selected;
  ctx.font = '12px system-ui, sans-serif';
  if (!tower) {
    ctx.fillStyle = 'rgba(240,235,220,0.6)';
    const hint = world.buildKind
      ? 'Click a stone pad to build. Q / E rotates the glass.'
      : 'Pick a tower card, or click glass to aim and upgrade.';
    ctx.fillText(hint, x, y + 40);
    return;
  }
  const spec = TOWERS[tower.kind];
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 13.5px system-ui, sans-serif';
  ctx.fillText(`${spec.name} · Lv ${tower.level + 1}`, x, y + 22);
  ctx.fillStyle = 'rgba(240,235,220,0.75)';
  ctx.font = '11.5px system-ui, sans-serif';
  ctx.fillText(TOWER_TAGS[tower.kind] + (tower.kind === 'mirror' || tower.kind === 'shard' ? ' · Q/E rotate' : ''), x, y + 40);
  const upCost = tower.level >= 3 ? null : [70, 130, 240][tower.level];
  if (upCost !== null) {
    registerButton(ctx, world, x + 196, y + 12, 104, 26, `Upgrade ${upCost}g`, 'upgrade', input, false);
  } else {
    ctx.fillStyle = '#ffd94e';
    ctx.fillText('Fully polished', x + 196, y + 25);
  }
  registerButton(ctx, world, x + 196, y + 44, 104, 26, `Sell ${Math.floor(tower.spent * 0.7)}g`, 'sell', input, false);
}

/** Centre banner: wave titles and warnings, fading in and out. */
function drawBanner(ctx, world) {
  const banner = world.banner;
  const fade = Math.min(1, banner.t * 4) * (banner.t > banner.ttl - 0.5 ? Math.max(0, (banner.ttl - banner.t) * 2) : 1);
  ctx.save();
  ctx.globalAlpha = fade * smooth(Math.min(1, banner.t * 3));
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,6,14,0.45)';
  roundRect(ctx, FIELD.width / 2 - 340, 128, 680, banner.sub ? 86 : 62, 14);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 30px Georgia, serif';
  ctx.fillText(banner.title, FIELD.width / 2, banner.sub ? 162 : 168);
  if (banner.sub) {
    ctx.fillStyle = '#f4ecd8';
    ctx.font = '14.5px system-ui, sans-serif';
    ctx.fillText(banner.sub, FIELD.width / 2, 190);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

/** Rounded rectangle path (does not fill or stroke). */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}
