# Decisions

Non-obvious choices and why. Newest at the bottom of each section.

## Direction

- **Prototype is a starting point, not a spec.** Its tuned numbers were ported (the spec's movement, timer, money and obstacle numbers are kept exactly), but the code is rewritten and its quirks fixed rather than reproduced. Balance was checked against the prototype run headlessly over the same 500 seeds: 3★ 85.8% → 84.6%, stumbles 0.126 → 0.086, ≤1 stumble 98.8% → 99.8%.
- **Delightfully simple** is the bar for anything added: one gesture per action, no shops, upgrades or currencies beyond the run's cash.

## Geography and look

- **Buildings on the right, avenue on the left.** Running south on the west sidewalk of 7th Ave puts the buildings (and Penn Station, which is on the west side) on your right. The prototype had this mirrored. The sim is symmetric, so this only affects rendering.
- **Sun from the right and slightly behind the camera, low and warm.** A real November sunset (~240°) sits ahead-right of a runner heading down 7th Ave (~209°), which would backlight every obstacle. Facades across the avenue face west and catch it; your side is in cool shadow, as the spec intended.
- **Subway entrances at W 49, W 42 and W 34** (the spec's streets, which match the real stations), not the prototype's 48/41/34.
- **No names or logos for MTA, NJ Transit or Con Ed** on props. The finish sign says PENN STATION.

## Simulation

- **`sim/` is plain TypeScript with `.ts` import paths and erasable syntax only**, so `node scripts/sim-report.ts` runs it with no build step. A test bans three.js, DOM globals, `Math.random`, wall-clock time and transcendental `Math` functions (not bit-identical across engines) from `sim/` and `config/`.
- **Events out, never state in.** The sim emits events (`coin`, `hit`, `knock`, `activate`, `announce`, `near-miss`, `express-start`…); rendering, audio and HUD react. Cosmetic randomness (knockback spin, which speech line) lives outside the sim.
- **Exact jump integration** (`y += v·dt − ½g·dt²`): peak 1.304 m and 0.705 s air at any step rate, and Alex's body follows the same parabola the quarter arcs are laid on.
- **Invulnerability is 1.5 s from impact** (the prototype's timing; covers the 1.35 s slowdown plus a short grace). The spec's wording implied 1.5 s *after* recovery, which would be ~26 m of ghosting at full speed.
- **Express lands exactly on its target** and never past FINISH − 40. Boarding the express grounds Alex and clears any stumble.
- **Pool floor of $50.** One seed in 500 came in under $45 on the prototype, and 3★ odds fall off on poor courses. Courses under $50 upgrade random dime lines to quarter lines until they reach it (affects ~1% of seeds; positions never change).
- **Power-ups are placed in an open lane** (no must-dodge obstacle just after) rather than a random one.
- **Patterns never spill past the end margin** (the prototype could place a long pattern over the victory dimes).
- **The $5 bill always exists**: on a jump-arc apex between 650 and 1150 m, or that stretch's highest coin if it has no arcs (rare).
- **Near miss** = you were lined up with a tall obstacle less than 0.3 s before passing it, and didn't hit it.

## Testing

- **Solvability is proven, not sampled.** `sim/solver.ts` runs one shared world and tracks every distinct player state reachable without a hit, branching on all inputs 30×/s. Near-identical states are merged into one real representative, which can only cause false negatives, never a false "solvable". 500 seeds, ~0.23 s each, sharded across five test files.
- **The bot test is separate** (≤1 stumble on ≥95% of seeds; 3★ rate 78–92%), because a hit never ends a run and a bot stumble doesn't mean a course is unsolvable.

## Rendering

- **three.js WebGLRenderer, no WebGPU.** Same behavior on iOS Safari and everywhere else.
- **Everything procedural, nothing downloaded.** The city, people, vehicles and props are built from low-poly primitives with baked vertex colors; facade windows are drawn per-pixel by a patched `MeshStandardMaterial` (lit-window fraction, storefront interiors, sills) so there are no textures to load. The whole game is ~193 KB gzipped, so "first playable in 3 s on 4G" holds even on slow 4G.
- **Procedural toy characters instead of a CC0 pack.** Each person is one `SkinnedMesh` with parts rigidly bound to 11 bones: one draw call per person, unique outfits per pedestrian, and every motion (run, jump tuck, baseball slide, stumble flail, celebrate, slump, phone-shuffle, camera, map, e-bike ride, tumble) is a few bone rotations. No downloads or licenses, and Alex's suit is two lines of config.
- **Merged geometry per city block** (facades, props, glow, signs, ground) rather than per-prop instancing: a block is ~6 draw calls. Things that move or repeat in large numbers are instanced: coins and bills, walk signals, pigeons, blob shadows. 104–139 draw calls in play.
- **Camera matches the prototype's framing exactly**: a level camera 7 m back and 3.4 m up with a vertical lens shift (`setViewOffset`) that puts Alex's feet at 84% of screen height on any aspect ratio. Verticals stay vertical, which suits the toy-diorama look.
- **Quality tiers.** Low: no post, DPR 1, no shadow map (blob shadows only). Medium: half-res bloom, DPR ≤ 1.5, 1024 shadow map. High: 4× MSAA, bloom, grade/vignette pass, DPR ≤ 2, 2048 soft shadows. Auto-picked from the title screen's frame times (never mid-run, so no shader recompiles at GO), remembered, and overridable in Settings.
- **Shader warm-up behind the title.** Every shader variant (instanced, skinned, sprites, screens) is compiled before the first run; without it a 233 ms hitch showed up the first time a new kind of object appeared.
- **Google Fonts at runtime** (the spec allows it) with system fallbacks; the boot waits up to 1.5 s for them so painted signs use the right faces.
- **Penn Station finish**: a recessed, lit doorway cut into the facade with an escalator down; the camera arcs out over the avenue to face it while Alex runs in, celebrates and rides down, then the scene cuts to the counter and the receipt prints line by line.
- **Alex's office** (a faceted glass tower with a slanted crown, by Bryant Park) is pulled in toward the avenue diorama-style so it looms over the far side as you leave Times Square. No name or logo.

## Product

- **Alex wears a navy suit, white shirt, red tie and brown dress shoes**, with brown hair, brown eyes and fair skin (he works in finance).
- **Today's Run uses New York's date** (`America/New_York`), so relatives in other time zones get the same route on the same day.
- **Share sheet on phones, clipboard on computers.** Desktop browsers also expose `navigator.share`, which would turn "Copy for the group chat" into a share sheet on a Mac.
- **Shares carry the link.** The share sheet gets the game's URL as its own field and the clipboard gets it on the last line, so Messages turns it into the preview card instead of sending bare text.
- **Control hint only on the first run**, worded for the device you're using.
- **No real brands**: see CREDITS.md.

## Graphics pass (round 2)

- **Rounded, smooth-shaded everything.** People are built from capsules, spheres and rounded boxes (vinyl-toy look) with faces: brown eyes with highlights, brows, nose, ears, side-parted hair. Vehicles have rounded bodies, glass bands, bumpers and hubcaps; trees are branching trunks with soft leaf clusters; lamps are real cobra-heads. Geometry is merged *indexed*, so smooth shapes cost ~4× fewer vertices than before.
- **Facades are a single procedural shader** (no textures): running-bond brick and rusticated stone up close (fading with distance to avoid shimmer), recessed windows, frames, sills and lintels via per-pixel bump, glass that reflects the street (low roughness plus environment map, Fresnel), and **interior mapping**: every window shows a small 3D room (lit or dark), every shop a deep lit interior with a counter and shelves. The Low tier gets a cheap variant.
- **Image-based lighting from a baked "street canyon"**: golden sky above, a ring of lit-window walls at the horizon, pavement below, so glass and metal reflect a street rather than flat haze.
- **Building trim**: stepped cornices with brackets on masonry, pilasters between bays, belt courses over the shops, and rooftop bulkheads, mechanicals and antennas for a broken skyline.
- **Anti-aliasing on every tier**: native MSAA on Low, FXAA plus the grade pass on Medium, 4× MSAA on High.
- **No frame stalls from content creation**: city blocks are built a slice at a time within a 2.5 ms per-frame budget (merges compacted incrementally, faster while the express overlay hides the street), and pedestrians come from a pool of ~28 prebuilt people warmed behind the title screen (building one costs ~15 ms on a slow phone). With 4× CPU throttling the phone proxy holds 60 fps with one 33 ms frame per 30 s, the same as before the upgrade; 100–134 draw calls.

## Graphics pass (round 3: people and obstacles)

- **People are continuous, sculpted bodies with smooth skinning.** Torso (seat, hips, waist, chest, shoulders), legs (thigh, knee, calf) and arms (shoulder, elbow, wrist) are each one lathed shape whose vertices blend between two bones around the joint, so bodies bend like bodies instead of a stack of capsules. Clothing is painted by height (trousers, tees with short sleeves, belts, shirt cuffs), coats get a flared skirt, and faces have whites of the eyes, highlights and a small smile. `src/actors/rig.ts` holds the skinning toolkit.
- **Dogs are skinned too** (one draw call each): body with a chest ruff, snout, nose, eyes, floppy or pointy ears, collar, paws and tail; they trot in a diagonal gait with a wagging tail.
- **Obstacles rebuilt**: tube-frame e-bike on torus tires with spokes, rack and a smaller headlight halo; cart with a 16-panel scalloped umbrella, sneeze guard, condiments, pretzel rack and propane tank; lumpy glossy trash bags with tied necks; cellar doors that actually stand open over steps going down; flared, capped steam stack; rounded sawhorse with lamps; pigeons with iridescent necks, beaks and wings.
- **Power-ups**: a thick extruded pizza slice with crust, pepperoni and cheese drips; a sitting orange tabby with ears, green eyes and whiskers; a rounded express card.
- `node scripts/lineup.ts <dir>` renders close-up lineups of the people, obstacles, power-ups and the e-bike for judging models.

## Link preview and icons

- **The preview image is a staged in-game render, not an illustration**, so it shows what you'll actually play. `scripts/share-image.ts` freezes a seeded run, holds Alex mid-leap at the top of a cash arc in Times Square, turns the camera around to face him, swings the sun behind the camera so it lights his face, and keeps the blocks he's already run (the game normally drops them). The title is the in-game street sign in HTML on top. It renders at 2× and downsamples to 1200×630 JPEG (about 130 KB, under WhatsApp's 300 KB limit).
- **Title on two lines, big.** Messages shows the card around 300 pt wide on a phone, where a one-line sign was too small to read.
- **Coins near the lens are hidden in the shot.** Up close they read as flat gray discs; the $1 bill Alex reaches for stays, turned to face the camera.
- **Icon: a pretzel on a street-sign-green square** with the sign's white border, drawn from the same rope curve as the HUD pretzel (`src/ui/icons.ts`), with the arms crossing over and under. It's deliberately not the pretzel-chain's blue and gold or its haloed pretzel. Full-bleed variants go to iOS (which rounds its own corners) and Android's maskable slot.
- **Absolute URLs are hard-coded in `index.html`** (canonical, `og:url`, `og:image`). Messengers ignore relative image URLs, and a build-time variable would be one more thing to forget. A test checks they agree, that the image matches its declared size and weight, and that every linked icon exists.
