# Dice Roller Presenters

Official result presenters for [RPG Dice Roller](https://github.com/dice-roller/rpg-dice-roller).

A shared TypeScript package of optional presenters. The initial SVG presenter
generates dice tray images from evaluated results. The package is not yet published.

## Development

Use Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The Vue demo shows the original dice icons
with example values, including percentile and Fudge dice. Its appearance controls
let you change the colours and toggle fills or values without changing the assets.
Below the icon gallery, an initial SVG output preview renders a fixed v6-shaped
result history with mixed dice, maths and modifiers. It shares the appearance
controls and exposes its input object for inspection.

```sh
npm run typecheck
npm test
npm run build
npm run check
```

`build` emits the library's JavaScript and TypeScript declarations into `dist/`.
`build:demo` creates a separate local demo build in `demo-dist/`.
Vue and Vite are development dependencies; neither is included in the library.

## Branches

- `main`: stable branch.
- `develop`: integration branch.
- `feature/svg-presenter`: SVG presenter development and local playground.

## SVG presenter

```typescript
import { Roll } from "@dice-roller/rpg-dice-roller";
import { SvgPresenter } from "@dice-roller/presenters/svg";

// Supply SVG template strings, keyed by shape (d2, d4, d6, etc.).
// Include a generic template for unsupported face counts.
const presenter = new SvgPresenter(artwork, { size: 140 });
const svg = new Roll("2d6 + 3").present(presenter);
```

The presenter supports rolls, histories and expression results. It uses the core
library's types and reads existing results without evaluating or rolling again.
The SVG renderer and text-slot helper live in `src/svg/`; the fixed sample result
and artwork gallery remain in `demo/`.

The dice roller is a peer dependency requiring v6 (including prereleases), and a
development dependency using the current rewrite from GitHub. The npm `next` tag
currently points to an older alpha with a different API.

The development dependency temporarily uses `feature/next/prepare-git-installation`,
a branch of `next` adding the package preparation hook needed for Git installs.
Switch it to `next` once that packaging fix is merged.

Pool and group descriptions are displayed once alongside their results. Inline
descriptions follow the pool or group; block descriptions sit above it and wrap
as needed. Set `showDescriptions: false` to hide them. The local demo includes
nested examples and a matching appearance control.
