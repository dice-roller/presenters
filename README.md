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

## Selecting dice

Each rendered die has `data-*` attributes on its enclosing `<g>`, covering its
SVG, caption and modifier markers. The die type is the core factory name
(`standard`, `percentile`, `fudge`, `range`, `face`, or a registered custom name).
The shape describes the artwork actually used, independently of the die type.
Face counts come directly from the core snapshot: for example, default `dF`
currently has three equally likely faces and uses the d6 artwork.

| Attribute                          | Value                                                           |
| ---------------------------------- | --------------------------------------------------------------- |
| `data-die-type`                    | Core die factory name                                           |
| `data-faces`                       | Face count, including repeated faces                            |
| `data-notation`                    | Die notation, such as `d20`, `d%`, or `dF`                      |
| `data-shape`                       | Artwork key, such as `d20`, `d6`, or `generic`                  |
| `data-min`, `data-max`             | Lowest and highest possible values                              |
| `data-value`, `data-initial-value` | Final and original rolled values                                |
| `data-calculation-value`           | Value used for scoring before exclusion                         |
| `data-use-in-total`                | The die's own inclusion state (`true` / `false`)                |
| `data-excluded`                    | Effective exclusion, including a dropped enclosing group member |
| `data-flags`                       | Space-separated modifier flags; empty if there are none         |

```css
[data-die-type="standard"][data-faces="20"] .die-outline {
  stroke: rebeccapurple;
}

[data-flags~="explode"] .die-value {
  font-weight: 800;
}

[data-excluded="true"] {
  opacity: 0.3;
}
```

```javascript
const dice = document.querySelectorAll('[data-die-type="fudge"]');
for (const die of dice) {
  console.log(Number(die.dataset.value), Number(die.dataset.faces));
}
```

Selectors work when the SVG is inserted inline in the document. Values remain
in the metadata when `showValues` is false; that option only hides visible text.

## Optional labels and totals

These appearance options default to `true`. Set any to `false` to hide that
part of the output; hidden labels do not reserve their usual layout space.

| Option               | Controls                                              |
| -------------------- | ----------------------------------------------------- |
| `showDiceLabels`     | Die notation below each icon                          |
| `showModifierLabels` | Modifier labels below dice and group modifier markers |
| `showNotation`       | The supplied notation above each roll                 |
| `showTotals`         | Individual roll totals and the history total          |

```typescript
const presenter = new SvgPresenter(artwork, {
  showDiceLabels: false,
  showModifierLabels: false,
  showNotation: false,
  showTotals: false,
});
```

Tooltips, `data-*` attributes, exclusion styling and calculated results remain
available independently of these visibility options.
