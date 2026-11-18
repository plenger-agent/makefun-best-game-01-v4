[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/plenger-agent/makefun-best-game-01-v4/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/plenger-agent/makefun-best-game-01-v4/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# HELIODROME: Bend the Noon

A sunbeam tower defence. One beam of sunlight enters your island from the
Heart Crystal, and the shades are coming down the road to put it out. You
cannot shoot them. You can only **bend the light**: place mirrors and prisms
of glass, rotate them, and steer the burning beam across the road. Shades
burn in the light — and heal in every shadow the light leaves behind,
including the ones your own towers cast.

Five islands, sixty waves, one moving sun.

## The campaign

| Island | Waves | What it teaches |
| --- | --- | --- |
| Dawn Coast | 1–12 | Mirrors, prisms, the first Eclipse |
| Noon Desert | 13–24 | Burrowers that travel under the road |
| Dusk Cliffs | 25–36 | The spiral, the armoured Dreadnought |
| Ember Shoals | 37–48 | Lava light, storm glass, tight gold |
| Frostmere | 49–60 | Ice roads the beam itself must melt |

Clear an island to earn up to three stars and unlock the next. The campaign
map (from the title screen) shows every island's weather, its warning, and
your stars. After wave 60, **Endless Noon** opens: escalating waves on a
random island under a random sky.

## The arsenal — eight kinds of glass

- **Sun Mirror** — reflects the beam at a true mirror angle. Aim it with Q/E.
- **Spectrum Prism** — splits white light into ember (burns over time),
  gilded (raw damage) and umbral (slowing) beams.
- **Moon Lens** — bends the beam a fixed 25° toward the road and deepens it.
- **Splitter Prism** — two beams at ±30° for covering forks and spirals.
- **Chime Bell** — no beam of its own: rings and staggers every lit shade.
- **Eclipse Shard** — fires a piercing lance down its aim line on a timer.
- **Chrono Lens** — turns the beam chrono: heavy slow, time made visible.
- **Storm Prism** — a five-way fan whose light arcs chain lightning.

Every tower upgrades three times. After each wave the light offers a
**spectrum blessing** — ten arts across six branches (Ember, Gilded,
Umbral, Chrono, Storm, Heart) that reshape the whole defence.

## The shades — twelve kinds

Duskmoths, Gloomcrawlers, Pale Wraiths, Umbral Beetles, Nightswifts,
Greater Shades, Mitosis Husks that split when killed, Veilspinners whose
woven veils halve the beam, **Deepburrowers** that dive under the road
where no light reaches, Gloom Colossi — and every tenth wave, **THE
ECLIPSE**: a boss that carries its own shadow with it, a disc of night
that swallows any beam crossing it. The **Dreadnought Shade**, a walking
fortress, splits into two Greater Shades when its plates finally crack.

## Weather and ground

- **Clouds** drift over every island. A beam dies inside a cloud's ground
  shadow, shades heal faster there, and a cloud over the sun itself dims
  every beam at the source. Watch the dial; re-route your mirrors.
- **Frostmere's ice** speeds shades by 45% — until your beam melts the
  sheet into open water, which slows them instead. Melt state persists
  for the whole island.
- **Night waves** invert the rules: the moonbeam is umbral, shades are
  faster and more fragile, and nothing heals in honest moonlight.
- The **sun moves**. Its angle sweeps all day, so a mirror network that
  was perfect at dawn is wrong by noon. Keep re-bending the light.

## Also in the dome

- **Codex** (key C) — every tower, shade and spectrum art, with lore.
- **12 achievements** — from First Blood to melting three ice sheets in
  one run — with toasts, saved between visits.
- **localStorage save** — campaign stars, unlocks, records, achievements,
  mute and speed preferences.
- A synthesized soundscape (WebAudio, no audio files): beam hums, chimes,
  storm cracks, melt hisses, achievement bells.

## Controls

Mouse to build and select; **Q/E** or the wheel to rotate aimed glass;
**Space** calls the next wave; **1–8** pick a tower card; **U** upgrade,
**X** sell, **P** pause, **C** codex, **M** mute.

## Run it

```
node serve.ts            # then open http://localhost:8080
node serve.ts --port 9000
```

No build step, no dependencies, no network: `game/` is plain static
files (ES modules + Canvas 2D). Node 22 runs the TypeScript hand-in
directly:

```
MAKEFUN_OUTPUT_DIR=out node main.ts   # copies game/ + screenshots/, writes dossier.json
```

## Layout

```
game/index.html        the page
game/src/config.js     every balance number, island art, spectrum tree
game/src/maps.js       five islands: paths, pads, dressing, ice
game/src/optics.js     beam tracing, occlusion, damage, ice melting
game/src/enemies.js    shade movement, ground, burrows, the Eclipse disc
game/src/towers.js     building, bells, shards, storm chains
game/src/waves.js      60 composed waves, feature waves, the director
game/src/weather.js    drifting clouds and the covered sun
game/src/world.js      game state, the step, achievements, saves
game/src/render.js     terrain, towers, shades, beams, HUD
game/src/campaign.js   the campaign map screen
game/src/codex.js      the codex screen
game/src/screens.js    title, blessings, endings, input dispatch
game/src/shots.js      staged scenes for the four hand-in screenshots
vendor/makefun-game.ts the vendored make.fun dossier library
```

MIT licensed — see LICENSE.
