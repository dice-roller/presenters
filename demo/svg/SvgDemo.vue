<script setup lang="ts">
import { computed, ref } from "vue";
import DemoNav from "../DemoNav.vue";
import { diceArtwork } from "./dice-artwork.js";
import {
  createRollExample,
  createRollExamples,
  createExampleHistory,
  decisionExampleDefinitions,
  singleRollDefinition,
} from "./roll-examples.js";
import { SvgPresenter } from "@dice-roller/svg-presenter";
import { fillValueSlot } from "../../packages/svg/src/value-slot.js";
import {
  modifierIcons,
  modifierIconStyles,
  renderModifierIcon,
} from "../../packages/svg/src/modifier-icons.js";

const { d2, d4, d6, d8, d10, d12, d20, generic } = diceArtwork;

const stroke = ref("#7962b5");
const fill = ref("#eee7fb");
const filled = ref(false);
const showValues = ref(true);
const showDescriptions = ref(true);
const showDiceLabels = ref(true);
const showVariableLabels = ref(true);
const showModifierLabels = ref(true);
const showModifierIcons = ref(true);
const modifierIconPosition = ref<"corner" | "below">("corner");
const monochromeModifiers = ref(false);
const showNotation = ref(true);
const showTotals = ref(true);
const width = ref(1040);
const noWrap = ref(false);
const sizes = {
  "x-small": 40,
  small: 80,
  medium: 140,
  large: 200,
  "x-large": 400,
} as const;
const size = ref<keyof typeof sizes>("medium");

// Only trusted, repository-owned SVG assets are inserted as markup.
function artwork(svg: string): string {
  return svg.replace(/^<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

const icons = [
  { label: "d2", svg: d2, value: "2" },
  { label: "d4", svg: d4, value: "4" },
  { label: "d6", svg: d6, value: "6" },
  { label: "d8", svg: d8, value: "8" },
  { label: "d10", svg: d10, value: "10" },
  { label: "d12", svg: d12, value: "12" },
  { label: "d20", svg: d20, value: "20" },
  { label: "d%", svg: d10, value: "100" },
  { label: "dF · minus", svg: d6, value: "−" },
  { label: "dF · blank", svg: d6, value: "" },
  { label: "dF · plus", svg: d6, value: "+" },
  { label: "Generic · d13", svg: generic, value: "13" },
].map((icon) => ({ ...icon, markup: artwork(icon.svg) }));

const presenter = computed(
  () =>
    new SvgPresenter({
      size: sizes[size.value],
      width:
        Number.isFinite(width.value) && width.value > 48 ? width.value : 1040,
      noWrap: noWrap.value,
      stroke: stroke.value,
      fill: fill.value,
      filled: filled.value,
      showValues: showValues.value,
      showDescriptions: showDescriptions.value,
      showDiceLabels: showDiceLabels.value,
      showVariableLabels: showVariableLabels.value,
      showModifierLabels: showModifierLabels.value,
      showModifierIcons: showModifierIcons.value,
      modifierIconPosition: modifierIconPosition.value,
      showNotation: showNotation.value,
      showTotals: showTotals.value,
    }),
);
// Evaluate once when this playground mounts. Appearance controls only present.
const examples = createRollExamples();
const singleExample = createRollExample(singleRollDefinition);
const history = createExampleHistory(examples);
const decisionHistory = createExampleHistory(
  decisionExampleDefinitions.map(createRollExample),
);
const singlePreview = computed(() =>
  singleExample.roll.present(presenter.value),
);
const preview = computed(() => history.present(presenter.value));
const decisionPreview = computed(() =>
  decisionHistory.present(presenter.value),
);
// Serialise result trees directly: Roll.toJSON() also calculates extrema.
const resultTrees = examples.map(({ id, data, roll }) => ({
  id,
  data,
  notation: roll.notation,
  total: roll.total,
  result: roll.result,
}));

const modifierLegend = [
  {
    flag: "explode",
    label: "Explode",
    detail: "Triggered an additional roll.",
  },
  {
    flag: "explode-matching-batch",
    label: "Matching batch explosion",
    detail: "The matching dice triggered another batch.",
  },
  {
    flag: "explode-matching-batch-failure",
    label: "Matching batch failure",
    detail: "The matching batch reset the pool score to zero.",
  },
  {
    flag: "compound",
    label: "Compound",
    detail: "Explosion results are combined into one value.",
  },
  {
    flag: "penetrate",
    label: "Penetrate",
    detail: "Explosion rolls have one subtracted.",
  },
  {
    flag: "re-roll",
    label: "Re-roll",
    detail: "The original result was replaced.",
  },
  {
    flag: "re-roll-once",
    label: "Re-roll once",
    detail: "A result was replaced by a once-only re-roll.",
  },
  {
    flag: "unique",
    label: "Unique",
    detail: "A duplicate was re-rolled for uniqueness.",
  },
  {
    flag: "unique-once",
    label: "Unique once",
    detail: "A duplicate was re-rolled once; duplicates may remain.",
  },
  { flag: "min", label: "Minimum", detail: "Raised to the specified minimum." },
  { flag: "max", label: "Maximum", detail: "Capped at the specified maximum." },
  {
    flag: "target-success",
    label: "Success",
    detail: "Matched a success target.",
  },
  {
    flag: "target-failure",
    label: "Failure",
    detail: "Matched a failure target.",
  },
  {
    flag: "critical-success",
    label: "Critical success",
    detail: "Matched the critical success condition.",
  },
  {
    flag: "critical-failure",
    label: "Critical failure",
    detail: "Matched the critical failure condition.",
  },
  {
    flag: "drop",
    label: "Dropped",
    detail: "Faded and crossed out; excluded from the total.",
  },
].map((entry, index) => {
  const kind = modifierIcons([entry.flag])[0];
  const symbol = kind
    ? renderModifierIcon(
        { kind, x: 3, y: 3, width: kind === "compound" ? 39 : 30, height: 30 },
        `modifier-legend-${index}`,
      )
    : `<g opacity=".4" fill="none" stroke="currentColor" stroke-width="2.2"><g transform="translate(3 3) scale(.3)">${fillValueSlot(artwork(d6), "4")}<path d="M14 50h72"/></g></g>`;

  return {
    ...entry,
    symbol: `<svg class="result-preview" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 36" width="45" height="36" aria-hidden="true"><style>${modifierIconStyles}</style>${symbol}</svg>`,
  };
});
</script>

<template>
  <main>
    <DemoNav />
    <p class="eyebrow">Dice Roller / Presenters</p>
    <h1>Dice artwork playground</h1>
    <p>
      Original blank SVGs with example values on a separate layer. Standard dice
      show their face count; percentile and Fudge dice reuse the d10 and d6
      shapes.
    </p>

    <fieldset class="controls">
      <legend>Appearance</legend>
      <label>
        Size
        <select v-model="size">
          <option v-for="(_value, name) in sizes" :value="name">
            {{ name }}
          </option>
        </select>
      </label>
      <label>
        SVG width
        <input
          v-model.number="width"
          type="number"
          min="49"
          step="10"
          :disabled="noWrap"
        />
      </label>
      <label
        ><input v-model="noWrap" type="checkbox" /> Keep each roll on one
        line</label
      >
      <label>Outline colour <input v-model="stroke" type="color" /></label>
      <label>Fill colour <input v-model="fill" type="color" /></label>
      <label><input v-model="filled" type="checkbox" /> Fill dice</label>
      <label><input v-model="showValues" type="checkbox" /> Show values</label>
      <label
        ><input v-model="showDescriptions" type="checkbox" /> Show
        descriptions</label
      >
      <label
        ><input v-model="showDiceLabels" type="checkbox" /> Show dice
        labels</label
      >
      <label>
        <input v-model="showVariableLabels" type="checkbox" /> Show variable
        labels
      </label>
      <label
        ><input v-model="showModifierLabels" type="checkbox" /> Show modifier
        labels</label
      >
      <label
        ><input v-model="showModifierIcons" type="checkbox" /> Show modifier
        icons</label
      >
      <label
        >Modifier position
        <select v-model="modifierIconPosition">
          <option value="corner">On the corner</option>
          <option value="below">Below the dice</option>
        </select></label
      >
      <label
        ><input v-model="monochromeModifiers" type="checkbox" /> Monochrome
        modifiers</label
      >
      <label
        ><input v-model="showNotation" type="checkbox" /> Show notation</label
      >
      <label><input v-model="showTotals" type="checkbox" /> Show totals</label>
    </fieldset>

    <section
      class="gallery"
      aria-label="Dice icon gallery"
      :style="{ '--die-size': `${sizes[size]}px` }"
    >
      <figure v-for="icon in icons" :key="icon.label" class="card">
        <svg
          class="die"
          viewBox="0 0 100 100"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :style="{ color: stroke, '--die-fill': filled ? fill : 'none' }"
          role="img"
          :aria-label="
            !showValues
              ? `${icon.label}, blank artwork`
              : `${icon.label}, result ${icon.value || 'blank (zero)'}`
          "
        >
          <g
            v-html="fillValueSlot(icon.markup, showValues ? icon.value : '')"
          />
        </svg>
        <figcaption v-if="showDiceLabels">{{ icon.label }}</figcaption>
      </figure>
    </section>

    <section
      class="presenter-preview"
      aria-labelledby="modifier-legend-heading"
    >
      <h2 id="modifier-legend-heading">Modifier flags</h2>
      <ul
        class="modifier-legend preview-output"
        :class="{ 'monochrome-modifiers': monochromeModifiers }"
        :style="{ color: stroke }"
      >
        <li v-for="entry in modifierLegend" :key="entry.flag">
          <span class="modifier-legend-symbol" v-html="entry.symbol" />

          <div>
            <strong>{{ entry.label }}</strong>
            <code>{{ entry.flag }}</code>
            <p>{{ entry.detail }}</p>
          </div>
        </li>
      </ul>

      <p>
        Flags can combine, for example compound and penetrate. Once variants
        share their family's icon. Keep marks excluded results as dropped;
        sorting only changes their order. A score label shows a result's
        contribution to its total.
      </p>
    </section>

    <section class="presenter-preview" aria-labelledby="single-roll-heading">
      <h2 id="single-roll-heading">Single roll preview</h2>
      <p>
        <code>{{ singleExample.roll.notation }}</code
        >: exploding d20s and only the highest d8 contributes to the total.
      </p>
      <div
        class="preview-output"
        :class="{ 'monochrome-modifiers': monochromeModifiers }"
        tabindex="0"
        aria-label="Scrollable single roll SVG result"
        v-html="singlePreview"
      />
      <details>
        <summary>Dice roller single-roll result</summary>
        <pre>{{ JSON.stringify(singleExample.roll.result, null, 2) }}</pre>
      </details>
    </section>

    <section class="presenter-preview" aria-labelledby="presenter-heading">
      <h2 id="presenter-heading">Presenter output preview</h2>
      <p>
        Real seeded rolls showing mixed dice, arithmetic, parentheses,
        functions, custom dice, keep/drop, explosions, rerolls, targets,
        criticals and caller data variables. Appearance changes reuse these
        results.
      </p>
      <p>
        Hover a pool, an operator between pools, or a group brace to highlight
        that part of the result. Only the most specific region is highlighted.
        Hover a function name or mathematical parenthesis to highlight its
        matching pair.
      </p>
      <div
        class="preview-output"
        :class="{ 'monochrome-modifiers': monochromeModifiers }"
        tabindex="0"
        aria-label="Scrollable SVG results"
        v-html="preview"
      />
      <details>
        <summary>Dice roller inputs and result trees</summary>
        <pre>{{ JSON.stringify(resultTrees, null, 2) }}</pre>
      </details>
    </section>
    <section class="presenter-preview" aria-labelledby="decisions-heading">
      <h2 id="decisions-heading">Comparisons and conditional rolls</h2>
      <div
        class="preview-output"
        :class="{ 'monochrome-modifiers': monochromeModifiers }"
        tabindex="0"
        aria-label="Scrollable comparison and conditional results"
        v-html="decisionPreview"
      />
    </section>
  </main>
</template>
