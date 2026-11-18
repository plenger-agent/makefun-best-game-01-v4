// The campaign map: five islands on one long road west to east.
//
// Between the title and the battle sits the map — a chart of the whole
// campaign the player is fighting. Each island is a node on a dotted
// road: cleared islands carry their stars, the frontier island glows,
// and locked islands sit under a drawn lock and a promise. Clicking an
// unlocked island starts a run at its first wave with a purse scaled to
// the journey; the map is also where the campaign's memory lives —
// waves, weather and warnings for every shore, read before sailing.

import { FIELD, ISLAND_ART, ISLAND_WEATHER, WAVES_PER_ISLAND } from './config.js';
import { roundRect, registerButton } from './render.js';
import { wrapText } from './codex.js';

/** Map nodes: chart positions and the story each island tells. */
export const CAMPAIGN_NODES = [
  {
    x: 170, y: 470, tagline: 'Where the light learns to bend.',
    warning: 'Moths and crawlers. The tutorial shore — gentle, golden, honest.',
  },
  {
    x: 400, y: 300, tagline: 'The road doubles back on itself.',
    warning: 'Switchbacks and the first burrowers, travelling under the road.',
  },
  {
    x: 620, y: 480, tagline: 'A spiral down into the caldera.',
    warning: 'Veilspinners and Greater Shades. The spiral is shadowed — bring violet.',
  },
  {
    x: 850, y: 290, tagline: 'Black glass, lava, and ash weather.',
    warning: 'Dreadnoughts walk here, and dark clouds drink the beam whole.',
  },
  {
    x: 1085, y: 460, tagline: 'The frozen lake at the end of the world.',
    warning: 'Ice roads and snow squalls. Melt the lake or be outrun on it.',
  },
];

/** Wave range label for an island index, e.g. "Waves 13–24". */
export function waveRangeLabel(islandIndex) {
  const first = islandIndex * WAVES_PER_ISLAND + 1;
  return `Waves ${first}–${first + WAVES_PER_ISLAND - 1}`;
}

/**
 * Draw the whole campaign screen. Reads the save through the world;
 * registers 'campaignStart' regions for unlocked islands and a
 * 'campaignClose' button back to the title.
 */
export function drawCampaign(ctx, world, input) {
  // The chart's sea: deep water with a slow gradient and faint soundings.
  const sea = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  sea.addColorStop(0, '#16283f');
  sea.addColorStop(0.55, '#1d3a56');
  sea.addColorStop(1, '#122238');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.strokeStyle = 'rgba(160,200,235,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i += 1) {
    ctx.beginPath();
    ctx.arc(200 + i * 130, 760, 90 + (i % 3) * 26, Math.PI * 1.15, Math.PI * 1.7);
    ctx.stroke();
  }
  // Compass rose, top right.
  drawCompass(ctx, 1170, 108);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 46px Georgia, serif';
  ctx.shadowColor = 'rgba(255,170,60,0.5)';
  ctx.shadowBlur = 22;
  ctx.fillText('The Long Noon Road', FIELD.width / 2, 92);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(244,236,216,0.85)';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Sixty waves. Five islands. One beam of sunlight, carried west to east.', FIELD.width / 2, 124);

  // The dotted road between the islands.
  ctx.strokeStyle = 'rgba(255,233,168,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([3, 11]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  CAMPAIGN_NODES.forEach((node, i) => {
    if (i === 0) ctx.moveTo(node.x, node.y);
    else ctx.lineTo(node.x, node.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  const save = world.save;
  CAMPAIGN_NODES.forEach((node, i) => {
    drawIslandNode(ctx, world, node, i, save?.islands[i], input);
  });

  // The selected island's chart-card along the bottom.
  const sel = world.campaignSel ?? 0;
  drawIslandCard(ctx, world, sel, save?.islands[sel], input);

  registerButton(ctx, world, 40, 36, 120, 38, '←  Title', 'campaignClose', input, false);
  ctx.textAlign = 'left';
}

/** One island on the chart: a little painted landmass with its state. */
function drawIslandNode(ctx, world, node, index, record, input) {
  const art = ISLAND_ART[index];
  const unlocked = record?.unlocked;
  const cleared = record?.cleared;
  const selected = (world.campaignSel ?? 0) === index;
  const hover = input && Math.hypot(input.mouse.x - node.x, input.mouse.y - node.y) < 74;

  ctx.save();
  ctx.translate(node.x, node.y);
  // Landmass: an irregular blob in the island's own colours.
  const blob = ctx.createRadialGradient(-12, -14, 8, 0, 0, 74);
  blob.addColorStop(0, unlocked ? art.groundLight : '#3a4152');
  blob.addColorStop(0.75, unlocked ? art.ground : '#2c3242');
  blob.addColorStop(1, unlocked ? art.groundDark : '#232936');
  ctx.fillStyle = blob;
  ctx.beginPath();
  const wobble = [1, 0.82, 0.95, 0.78, 0.9, 0.84, 0.96, 0.8];
  for (let k = 0; k <= 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    const r = 62 * wobble[k % 8];
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r * 0.72;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = selected ? '#ffe9a8' : unlocked ? 'rgba(255,240,200,0.5)' : 'rgba(200,210,230,0.25)';
  ctx.lineWidth = selected ? 3 : 1.6;
  ctx.stroke();
  // Shore foam.
  ctx.strokeStyle = unlocked ? 'rgba(240,250,255,0.5)' : 'rgba(200,210,230,0.15)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.ellipse(0, 4, 70, 52, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();

  ctx.textAlign = 'center';
  if (!unlocked) {
    ctx.fillStyle = 'rgba(230,238,255,0.85)';
    ctx.font = '700 30px system-ui, sans-serif';
    ctx.fillText('🔒', 0, -2);
    ctx.font = '600 12.5px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(230,238,255,0.6)';
    ctx.fillText('Clear the island before', 0, 26);
  } else {
    ctx.fillStyle = '#fff6d8';
    ctx.font = '700 15.5px Georgia, serif';
    ctx.shadowColor = 'rgba(6,10,18,0.85)';
    ctx.shadowBlur = 5;
    ctx.fillText(art.name, 0, -8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(244,236,216,0.75)';
    ctx.font = '12.5px system-ui, sans-serif';
    ctx.fillText(waveRangeLabel(index), 0, 14);
    if (cleared) drawStars(ctx, 0, 34, record.stars);
    else if (index > 0) {
      ctx.fillStyle = '#ffd94e';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillText('· THE FRONTIER ·', 0, 34);
    }
  }
  ctx.restore();

  if (unlocked) {
    world.uiRegions.push({ x: node.x - 74, y: node.y - 56, w: 148, h: 112, action: 'campaignSelect', data: index });
  }
  void hover;
}

/** A row of earned stars (0–3), centred at (x, y). */
export function drawStars(ctx, x, y, stars) {
  ctx.font = '15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd94e' : 'rgba(244,236,216,0.3)';
    ctx.fillText('★', x + (i - 1) * 20, y);
  }
}

/** The chart-card for the selected island: story, weather, warning, sail. */
function drawIslandCard(ctx, world, index, record, input) {
  const art = ISLAND_ART[index];
  const node = CAMPAIGN_NODES[index];
  const x = 190;
  const y = 596;
  const w = FIELD.width - 380;
  const h = 168;
  ctx.fillStyle = 'rgba(16,14,28,0.88)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,217,138,0.4)';
  ctx.lineWidth = 1.4;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 24px Georgia, serif';
  ctx.fillText(`${art.name} — ${waveRangeLabel(index)}`, x + 26, y + 38);
  ctx.fillStyle = 'rgba(244,236,216,0.9)';
  ctx.font = 'italic 15px Georgia, serif';
  ctx.fillText(node.tagline, x + 26, y + 64);
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(244,236,216,0.85)';
  wrapText(ctx, node.warning, x + 26, y + 92, w - 300, 20);
  ctx.fillStyle = 'rgba(160,200,235,0.85)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`Weather: ${ISLAND_WEATHER[index]}`, x + 26, y + 140);

  if (record?.unlocked) {
    registerButton(ctx, world, x + w - 236, y + 96, 200, 50,
      record.cleared ? 'Sail Again ⛵' : 'Sail Here ⛵', 'campaignStart', input, true, index);
    if (record.cleared) drawStars(ctx, x + w - 136, y + 78, record.stars);
  } else {
    ctx.fillStyle = 'rgba(230,238,255,0.55)';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔒  Clear the previous island to sail here.', x + w - 136, y + 122);
    ctx.textAlign = 'left';
  }
}

/** A small compass rose. */
function drawCompass(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(255,233,168,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    ctx.fillStyle = i === 0 ? '#ffd94e' : 'rgba(255,233,168,0.6)';
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
    ctx.lineTo(Math.cos(a + 0.22) * 9, Math.sin(a + 0.22) * 9);
    ctx.lineTo(Math.cos(a - 0.22) * 9, Math.sin(a - 0.22) * 9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 13px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', 0, -38);
  ctx.restore();
}
