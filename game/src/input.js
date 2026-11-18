// Input: mouse and keyboard, translated into the game's logical field.
//
// The canvas fills the window; the game thinks in 1280x800. This module
// owns the conversion (letterboxed fit), tracks the pointer and keys,
// and turns wheel turns into mirror rotations. Clicks are dispatched by
// the screen module against the hit regions the renderer registered
// last frame, so what you see is exactly what you can press.

import { FIELD } from './config.js';

/** Create input state bound to a canvas. */
export function makeInput(canvas) {
  const input = {
    mouse: { x: 0, y: 0, down: false, inside: false },
    keys: new Set(),
    clicked: null, // {x, y} for one frame after a click
    wheel: 0, // accumulated wheel delta for one frame
    view: { scale: 1, ox: 0, oy: 0 },
  };

  function refit() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const scale = Math.min(w / FIELD.width, h / FIELD.height);
    input.view = { scale, ox: (w - FIELD.width * scale) / 2, oy: (h - FIELD.height * scale) / 2 };
    canvas.width = Math.round(FIELD.width * scale * window.devicePixelRatio);
    canvas.height = Math.round(FIELD.height * scale * window.devicePixelRatio);
    canvas.style.width = `${Math.round(FIELD.width * scale)}px`;
    canvas.style.height = `${Math.round(FIELD.height * scale)}px`;
  }

  function toLogical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / input.view.scale,
      y: (event.clientY - rect.top) / input.view.scale,
    };
  }

  window.addEventListener('resize', refit);
  refit();

  canvas.addEventListener('pointermove', (event) => {
    const p = toLogical(event);
    input.mouse.x = p.x;
    input.mouse.y = p.y;
    input.mouse.inside = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = toLogical(event);
    input.mouse.down = true;
    input.clicked = p;
  });
  window.addEventListener('pointerup', () => { input.mouse.down = false; });
  canvas.addEventListener('pointerleave', () => { input.mouse.inside = false; });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    input.wheel += Math.sign(event.deltaY);
  }, { passive: false });
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.keys.add(event.key.toLowerCase());
    if ([' ', 'arrowup', 'arrowdown'].includes(event.key.toLowerCase())) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => { input.keys.delete(event.key.toLowerCase()); });

  /** Consume and clear the per-frame click and wheel (call once per step). */
  input.takeFrame = () => {
    const frame = { clicked: input.clicked, wheel: input.wheel };
    input.clicked = null;
    input.wheel = 0;
    return frame;
  };

  /** True while a key (lowercase name) is held. */
  input.held = (key) => input.keys.has(key);

  return input;
}
