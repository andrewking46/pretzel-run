# Credits

Everything you see and hear is made in code: buildings, people, Alex, vehicles, signs, coins, sky and every sound effect and note of music are generated at runtime. No third-party models, textures or audio are bundled. The link-preview illustration and the app icons in `public/` are drawn in code (`scripts/share-art.ts`) and rendered by `scripts/share-image.ts`.

## Runtime

| What | License | Notes |
|---|---|---|
| [three.js](https://threejs.org) r187 | MIT | Rendering, plus its addons: EffectComposer, UnrealBloomPass, OutputPass, ShaderPass, BufferGeometryUtils |
| [Bebas Neue](https://fonts.google.com/specimen/Bebas+Neue) by Dharma Type | SIL Open Font License 1.1 | Loaded from Google Fonts at runtime; falls back to system condensed fonts offline |
| [Archivo](https://fonts.google.com/specimen/Archivo) by Omnibus-Type | SIL Open Font License 1.1 | Google Fonts |
| [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) by IBM | SIL Open Font License 1.1 | Google Fonts (the receipt) |

## Development only

Vite, TypeScript, Vitest, Playwright: all MIT or Apache-2.0, not shipped.

## Real places, no real brands

The route, streets and landmarks are real. Brand names appear only as plain text where the game calls for them: "AUNTIE ANNE'S" on the receipt and a small Penn Station sign. There are no logos, trade dress or real advertisers. Times Square screens are abstract shader art, the subway is just "SUBWAY", and the express card is a generic teal ticket. Alex's office tower is a faceted glass silhouette with no name.
