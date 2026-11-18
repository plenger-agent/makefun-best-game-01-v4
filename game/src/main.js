// HELIODROME: Bend the Noon — entry point and frame loop.
//
// Wires the pieces together: canvas and letterboxed input, the world,
// the fixed-step simulation (three substeps of the render frame, so a
// fast display never changes the game's physics), the renderers, and
// the ?shot= staging hook the hand-in screenshots are taken through.
// Everything with rules lives in the modules; this file only conducts.

import { FIELD } from './config.js';
import { makeAudio } from './audio.js';
import { makeInput } from './input.js';
import { loadSave } from './save.js';
import { makeWorld, stepWorld } from './world.js';
import { drawScene } from './render.js';
import { drawScreens, handleClick, handleKey, applyAimKeys } from './screens.js';
import { drawCampaign } from './campaign.js';
import { installShotScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = FIELD.width;
canvas.height = FIELD.height;

const audio = makeAudio();
const world = makeWorld(audio, loadSave());
const input = makeInput(canvas);

// Input is state, not events: dispatch the frame's click and any key
// that went down since last frame to the screen module.
let prevKeys = new Set();
function dispatchInput(frameInput) {
  if (frameInput.clicked) handleClick(world, frameInput.clicked.x, frameInput.clicked.y);
  for (const key of input.keys) {
    if (!prevKeys.has(key)) handleKey(world, key);
  }
  prevKeys = new Set(input.keys);
}

// A staged still for the hand-in: ?shot=cover|eclipse|frost|campaign.
const shotName = new URLSearchParams(location.search).get('shot');
if (shotName) installShotScene(world, shotName);

// Exposed for debugging and for the screenshot harness.
window.__heliodrome = world;

let last = performance.now();
let announced = '';

/** One animation frame: step (unless frozen), route, draw, announce. */
function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  const frameInput = input.takeFrame();

  if (!world.shotMode) {
    dispatchInput(frameInput);
    if (!world.paused && world.screen !== 'campaign') {
      const steps = world.speed;
      for (let i = 0; i < steps; i += 1) stepWorld(world, elapsed);
    } else {
      world.time += elapsed;
    }
    applyAimKeys(world, input, frameInput);
  }

  // The canvas backing store is sized by the input's letterbox fit;
  // scale logical coordinates onto it.
  ctx.setTransform(canvas.width / FIELD.width, 0, 0, canvas.height / FIELD.height, 0, 0);
  ctx.clearRect(0, 0, FIELD.width, FIELD.height);
  if (world.screen === 'campaign') {
    world.uiRegions = [];
    drawCampaign(ctx, world, input);
  } else {
    drawScene(ctx, world, input);
    drawScreens(ctx, world, input);
  }

  announce();
  if (world.shotMode) window.__shotReady = true;
  requestAnimationFrame(frame);
}

/** Keep the screen-reader status line truthful, without chatter. */
function announce() {
  const el = document.getElementById('status');
  if (!el) return;
  let text = '';
  if (world.screen === 'title') text = 'HELIODROME. Title screen. Activate Begin the Defence to play.';
  else if (world.screen === 'campaign') text = `Campaign map. ${world.island.name} selected.`;
  else if (world.screen === 'over') text = `Game over on wave ${world.wave}. Score ${world.score}.`;
  else if (world.screen === 'victory') text = `Victory. Score ${world.score}. Endless Noon is open.`;
  else text = `Wave ${world.wave} on ${world.island.name}. Gold ${world.gold}. Lives ${world.lives}. Score ${world.score}.`;
  if (text !== announced) {
    announced = text;
    el.textContent = text;
  }
}

requestAnimationFrame(frame);
