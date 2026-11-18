// Two-dimensional geometry the optics, the pathing and the weather share.
//
// Points are plain {x, y} objects. The beam tracer lives on segment
// intersection and reflection; the enemies live on polyline arc lengths;
// the clouds live on ellipse containment. Keeping all three here means
// optics.js, enemies.js and weather.js never re-derive them.

/** Vector from a to b. */
export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** a + b component-wise. */
export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** a scaled by s. */
export function scale(a, s) {
  return { x: a.x * s, y: a.y * s };
}

/** Dot product. */
export function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

/** Euclidean length. */
export function length(a) {
  return Math.hypot(a.x, a.y);
}

/** Unit vector in the direction of a (zero vector stays zero). */
export function normalise(a) {
  const len = length(a);
  return len === 0 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
}

/** Distance between two points. */
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Reflect direction d off a surface with unit normal n. */
export function reflect(d, n) {
  const k = 2 * dot(d, n);
  return { x: d.x - k * n.x, y: d.y - k * n.y };
}

/** Rotate a vector by angle radians. */
export function rotate(a, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** The unit vector at angle radians. */
export function fromAngle(angle) {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/** Angle of a vector, for aiming sprites along their travel. */
export function angleOf(a) {
  return Math.atan2(a.y, a.x);
}

/**
 * Closest point on segment ab to point p, and the distance to it.
 * Returns {point, dist, t} with t in [0, 1] along the segment.
 */
export function closestOnSegment(p, a, b) {
  const ab = sub(b, a);
  const denom = dot(ab, ab);
  const t = denom === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / denom));
  const point = add(a, scale(ab, t));
  return { point, dist: distance(p, point), t };
}

/**
 * Ray (origin + t*dir, t >= 0) against a circle. Returns the smallest
 * positive t, or Infinity when the ray misses or starts inside going out.
 */
export function rayCircle(origin, dir, centre, radius) {
  const oc = sub(origin, centre);
  const b = dot(oc, dir);
  const c = dot(oc, oc) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const root = Math.sqrt(disc);
  const t1 = -b - root;
  if (t1 > 0.001) return t1;
  const t2 = -b + root;
  return t2 > 0.001 ? t2 : Infinity;
}

/**
 * Ray against a line segment (a mirror's face). Returns {t, u} — distance
 * along the ray and position along the segment — or null on a miss.
 */
export function raySegment(origin, dir, a, b) {
  const edge = sub(b, a);
  const denom = dir.x * edge.y - dir.y * edge.x;
  if (Math.abs(denom) < 1e-9) return null;
  const diff = sub(a, origin);
  const t = (diff.x * edge.y - diff.y * edge.x) / denom;
  const u = (diff.x * dir.y - diff.y * dir.x) / denom;
  if (t > 0.001 && u >= 0 && u <= 1) return { t, u };
  return null;
}

/** Total arc length of a polyline. */
export function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distance(points[i - 1], points[i]);
  return total;
}

/**
 * Point at arc length s along a polyline, plus the direction of travel.
 * s is clamped to the ends. Returns {point, dir}.
 */
export function pointAlong(points, s) {
  let remaining = Math.max(0, s);
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const seg = distance(a, b);
    if (remaining <= seg || i === points.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, remaining / seg);
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        dir: normalise(sub(b, a)),
      };
    }
    remaining -= seg;
  }
  const last = points[points.length - 1];
  return { point: { x: last.x, y: last.y }, dir: { x: 1, y: 0 } };
}

/**
 * True when point p lies inside the axis-aligned ellipse centred at c
 * with radii (rx, ry). Ice patches and cloud shadows are ellipses.
 */
export function insideEllipse(p, c, rx, ry) {
  const dx = (p.x - c.x) / rx;
  const dy = (p.y - c.y) / ry;
  return dx * dx + dy * dy <= 1;
}

/**
 * How deep inside an ellipse a point sits: 0 at the rim, 1 at the centre,
 * negative outside. Used to grade ice-melt and cloud-shadow strength.
 */
export function ellipseDepth(p, c, rx, ry) {
  const dx = (p.x - c.x) / rx;
  const dy = (p.y - c.y) / ry;
  return 1 - Math.sqrt(dx * dx + dy * dy);
}

/** Clamp v into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** Linear interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smoothstep easing in [0, 1]. */
export function smooth(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Parse a #rrggbb colour into [r, g, b]. */
export function hexRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Blend two #rrggbb colours; returns an rgb() string for canvas. */
export function lerpColour(hexA, hexB, t) {
  const a = hexRgb(hexA);
  const b = hexRgb(hexB);
  const r = Math.round(lerp(a[0], b[0], t));
  const g = Math.round(lerp(a[1], b[1], t));
  const bl = Math.round(lerp(a[2], b[2], t));
  return `rgb(${r},${g},${bl})`;
}
