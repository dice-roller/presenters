# SVG presenter

CSS-stylable SVG output for [RPG Dice Roller](https://github.com/dice-roller/rpg-dice-roller) v6.

```sh
npm install @dice-roller/svg-presenter @dice-roller/rpg-dice-roller@next
```

Run the local playground from the repository root with `npm run dev`, then open `/svg/`.

## SVG presenter

```typescript
import { Roll } from "@dice-roller/rpg-dice-roller";
import { SvgPresenter } from "@dice-roller/svg-presenter";

// Standard dice artwork is included automatically.
const presenter = new SvgPresenter();
const svg = new Roll("2d6 + 3").present(presenter);
```

The presenter supports rolls, histories and expression results. It uses the core
library's types and reads existing results without evaluating or rolling again.
The SVG renderer and text-slot helper live in `packages/svg/src/`. The artwork
gallery lives in `demo/svg/`, and shared fixed-result fixtures live in
`packages/svg/tests/fixtures/`.

The dice roller is a peer dependency requiring v6 (including prereleases), and a
development dependency using the published v6 beta. Vue and Vite are only used
by the local demo and are not package dependencies.

The presenter bundles the default dice artwork as SVG strings. It works in Node
and browsers without filesystem access, fetch requests or SVG import loaders.

Pass appearance settings in a single options object. To customise artwork, add
only the shapes you want to override under `artwork`. Other shapes, including the
generic fallback, retain their bundled defaults. `SvgPresenterOptions` is exported
for reusable option objects.

```typescript
const presenter = new SvgPresenter({ size: 100 });

// customD20Svg is your trusted SVG template string.
const customised = new SvgPresenter({
  size: 100,
  artwork: { d20: customD20Svg },
});
```

Artwork keys are `d2`, `d4`, `d6`, `d8`, `d10`, `d12`, `d20` and `generic`.
Percentile dice use `d10`, and Fudge dice use `d6`. Add a key such as `d13` to
provide dedicated artwork for another face count, or override `generic` to
change the fallback. Custom templates must include an empty
`<text data-slot="value">` element as described in the [artwork guide](assets/dice/README.md).

The frozen `defaultArtwork` map is also exported for galleries and direct
`renderSvg` calls. Raw SVG assets remain available through exports such as
`@dice-roller/svg-presenter/icons/d20.svg`; Vite users can append `?raw` when
importing a custom template string.

Pool and group descriptions are displayed once alongside their results. Inline
descriptions follow the pool or group; block descriptions sit above it and wrap
as needed. Set `showDescriptions: false` to hide them. The local demo includes
nested examples and a matching appearance control.

## Width and wrapping

`width` sets the SVG drawing width, including 24 units of padding on each side.
It defaults to `1040`. Results and notation wrap to fit that width. The value
must be finite and greater than `48`.

```typescript
const presenter = new SvgPresenter({ width: 800 });
```

Use `noWrap: true` to keep each roll expression on a single line. The SVG then
sizes itself to its contents; `width` does not constrain it. Histories still
place each roll separately, and labels, descriptions and modifier flags retain
their own layout around the dice.

```typescript
const presenter = new SvgPresenter({ noWrap: true });
```

These are SVG drawing units, not the containing element's pixel width. CSS can
scale the output, but does not recalculate wrapping. A wide, unwrapped SVG can
be placed inside a horizontally scrolling container to retain readable dice.

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

## Selecting dice pools

Every pool has a `g.dice-pool-result` wrapper with `data-pool="true"`.
It contains the pool's parentheses, dice and descriptions. A transparent hit area
lets blank spaces show the pool tooltip; dice and modifier icons keep their own
more specific tooltips. Pools inside a group member retain both nested wrappers.

| Attribute            | Meaning                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `data-notation`      | Canonical pool notation, including modifiers, without descriptions |
| `data-quantity`      | Initial evaluated dice quantity                                    |
| `data-result-count`  | Number of resulting dice, including generated and dropped results  |
| `data-counted-count` | Results whose own `useInTotal` flag is true                        |
| `data-value`         | Pool value after its own modifiers                                 |

For example, a pool tooltip can show
`Dice pool: 3d8kh1; 3 results; 1 counted; total 8`.
Counts refer to the resulting snapshot, rather than discarded reroll attempts.
A pool in a dropped group member retains its own value and counted results; its
tooltip additionally notes exclusion by the enclosing group. The group member's
tooltip reports its effective contribution. Metadata and hover areas remain
available when visible labels, values, notation or totals are hidden.

```javascript
const pools = document.querySelectorAll('g[data-pool="true"]');
```

## Hover highlights

Inline SVG highlights the most specific pool, group member or roll group under
pointer hover with a faint fill and rounded outline. Hover a pool's dice or blank
space for the pool highlight; hover an operator between pools for the member;
hover group braces, commas or its description for the whole group. Ancestor
highlights are suppressed while a nested region is hovered, including nested
roll groups. Dice and modifier icons retain their own tooltips.

Whole groups use `g.roll-group-result[data-group="true"]`, with `data-notation`,
`data-member-count`, `data-counted-count` and `data-value`. These wrappers remain
available when descriptions, labels, icons or totals are hidden.

```css
.result-preview {
  --result-hover-color: currentColor;
  --result-hover-fill-opacity: 0.05;
  --result-hover-stroke-opacity: 0.45;
}

/* Hide visual highlights while retaining hover areas and tooltips. */
.result-preview.no-highlights {
  --result-hover-fill-opacity: 0;
  --result-hover-stroke-opacity: 0;
}
```

Highlight outlines do not intercept pointer events or reserve layout space.
The SVG includes the CSS, using `:hover` and `:has()` in supporting browsers;
external page styles can customise an SVG embedded inline. An SVG used through
`<img>` does not expose these interactive regions to the containing page.

## Matching mathematical parentheses

Hover a function name or either of its parentheses to brighten the name and both
parentheses together. Hover either
mathematical grouping parenthesis to brighten its matching partner. Arguments
and nested pairs do not trigger the outer pair. Dice-pool parentheses retain
only their existing pool highlight.

This includes parentheses inserted by the presenter to preserve precedence.
No font-size or weight changes are used, so the highlight does not shift text.
Function and grouping scopes use `g.math-group-result` with `data-math-group`
set to `function` or `parentheses`. Functions also expose `data-function`.
These effects use CSS `:has()` and require an interactive SVG.

```css
.result-preview {
  --math-hover-color: #bda0ff;
}
```

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
const presenter = new SvgPresenter({
  showDiceLabels: false,
  showModifierLabels: false,
  showNotation: false,
  showTotals: false,
});
```

Tooltips, `data-*` attributes, exclusion styling and calculated results remain
available independently of these visibility options.

## Modifier icons

The presenter displays open line symbols for explosions, compound and penetrating
explosions, rerolls, unique, min/max, target successes/failures, and critical
successes/failures. Critical success uses a star; critical failure uses a skull.
Compound explosions show overlapping purple and amber bursts. Combined compound
and penetrate outcomes show two separate symbols. Dropped results remain faded
and crossed out. Keep and sort do not need additional icons.

```typescript
const presenter = new SvgPresenter({
  showModifierIcons: true,
  modifierIconPosition: "below", // "corner" (default) or "below"
});
```

`showModifierIcons` is independent of `showModifierLabels`. Once and limited
variants share their family's symbol; labels and tooltips retain their details.
Icons represent actual result flags, rather than every modifier in the notation.
A uniqueness icon means a duplicate was rerolled, not that uniqueness is guaranteed.
Group modifier labels are smaller captions centred beneath the whole member and wrap
within its width. Group member flags are displayed on that member, without repeating them on every
nested die. Icons wrap into additional rows when needed.

Corner placement cuts transparent circular gaps out of the artwork behind each
symbol. It does not paint a background colour. Below placement generates no
artwork cutouts; the compound symbol still masks its rear burst internally.
Every render generates unique mask identifiers, so multiple outputs can share a
page safely. Keep the generated definitions with their SVG.

Each icon has `data-modifier` and a matching `modifier-*` class. Values are:
`explode`, `compound`, `penetrate`, `re-roll`, `unique`, `min`, `max`,
`target-success`, `target-failure`, `critical-success`, and `critical-failure`.
Icons remain meaningful in monochrome. Colours can be overridden with CSS:

```css
.result-preview {
  --modifier-explode-color: #9b5d0a;
  --modifier-critical-success-color: #96700b;
}

/* One colour for all symbols, including compound's rear burst. */
.result-preview.monochrome {
  --modifier-icon-color: currentColor;
}
```

Every icon family supports `--modifier-{data-modifier}-color`. Compound's rear
burst follows `--modifier-explode-color`. The demo includes placement, visibility
and monochrome controls, plus fixed examples of every modifier family.
