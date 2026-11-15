<script setup lang="ts">
import { computed, ref } from "vue";
import { diceArtwork } from "./dice-artwork.js";
import { SvgPresenter } from "../src/svg/index.js";
import { sampleResult, sampleRoll } from "./presenter/sample-result.js";
import { fillValueSlot } from "../src/svg/value-slot.js";
const { d2, d4, d6, d8, d10, d12, d20, generic } = diceArtwork;

const stroke = ref("#7962b5");
const fill = ref("#eee7fb");
const filled = ref(false);
const showValues = ref(true);
const showDescriptions = ref(true);
const showDiceLabels = ref(true);
const showModifierLabels = ref(true);
const showModifierIcons = ref(true);
const modifierIconPosition = ref<"corner" | "below">("corner");
const monochromeModifiers = ref(false);
const showNotation = ref(true);
const showTotals = ref(true);
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
    new SvgPresenter(diceArtwork, {
      size: sizes[size.value],
      stroke: stroke.value,
      fill: fill.value,
      filled: filled.value,
      showValues: showValues.value,
      showDescriptions: showDescriptions.value,
      showDiceLabels: showDiceLabels.value,
      showModifierLabels: showModifierLabels.value,
      showModifierIcons: showModifierIcons.value,
      modifierIconPosition: modifierIconPosition.value,
      showNotation: showNotation.value,
      showTotals: showTotals.value,
    }),
);
const singlePreview = computed(() => presenter.value.present(sampleRoll));
const preview = computed(() => presenter.value.present(sampleResult));
</script>

<template>
  <main>
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

    <section class="presenter-preview" aria-labelledby="single-roll-heading">
      <h2 id="single-roll-heading">Single roll preview</h2>
      <p>
        <code>2d20! + 3d8kh</code>: one d20 explodes for an extra roll, and only
        the highest d8 contributes to the total.
      </p>
      <div
        class="preview-output"
        :class="{ 'monochrome-modifiers': monochromeModifiers }"
        tabindex="0"
        aria-label="Scrollable single roll SVG result"
        v-html="singlePreview"
      />
      <details>
        <summary>Fixed single roll object</summary>
        <pre>{{ JSON.stringify(sampleRoll, null, 2) }}</pre>
      </details>
    </section>

    <section class="presenter-preview" aria-labelledby="presenter-heading">
      <h2 id="presenter-heading">Presenter output preview</h2>
      <p>
        A fixed result object showing mixed dice, arithmetic, parentheses,
        functions, custom dice, keep/drop, explosions, rerolls, targets and
        criticals. Appearance changes reuse these results.
      </p>
      <p>
        Hover a pool, an operator between pools, or a group brace to highlight
        that part of the result. Only the most specific region is highlighted.
        Hover a function name or mathematical parenthesis to highlight its
        matching pair.
      </p>
      <p class="legend">
        Faded and crossed out = excluded · burst = explosion · overlapping
        bursts = compound · piercing arrow = penetrate · circular arrow = reroll
        · diamond among circles = unique · floor / ceiling arrows = min / max ·
        tick / cross = target success / failure · star / skull = critical
        success / failure · score = contribution to the total.
      </p>
      <div
        class="preview-output"
        :class="{ 'monochrome-modifiers': monochromeModifiers }"
        tabindex="0"
        aria-label="Scrollable SVG results"
        v-html="preview"
      />
      <details>
        <summary>Fixed result object</summary>
        <pre>{{ JSON.stringify(sampleResult, null, 2) }}</pre>
      </details>
    </section>
  </main>
</template>

<style>
:root {
  --die-size: 140px;
  --die-fill: none;

  --page-bg: #fff;
  --page-text-color: #0a0a0a;
  --card-bg: #f7f7f7;

  font-family: system-ui, sans-serif;
  color: var(--page-text-color);
  background: var(--page-bg);
  color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --page-bg: #17151e;
    --page-text-color: #ede9f4;
    --card-bg: #211d2a;
  }
}

body {
  margin: 0;
}
main {
  max-width: 1080px;
  margin: 0 auto;
  padding: 48px 24px;
}
.eyebrow {
  color: #d8b4fe;
}
h1 {
  font-size: clamp(2rem, 5vw, 3rem);
  margin: 12px 0;
}
p {
  line-height: 1.7;
  max-width: 70ch;
}
.controls {
  position: sticky;
  top: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  margin: 28px 0;
  padding: 20px;
  border: 1px solid #655970;
  border-radius: 12px;
  background-color: var(--page-bg);
}
.controls label {
  display: flex;
  align-items: center;
  gap: 8px;
}
input[type="color"] {
  width: 42px;
  height: 32px;
}
.gallery {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, calc(var(--die-size) + 40px)), 1fr)
  );
  gap: 18px;
}
.card {
  display: grid;
  justify-items: center;
  gap: 16px;
  margin: 0;
  padding: 24px 16px;
  color: #3b2c50;
  background: var(--card-bg);
  border-radius: 14px;
}

.die {
  display: block;
  width: var(--die-size);
  height: var(--die-size);
}
.die-outline {
  fill: var(--die-fill, none);
}
.die-value {
  fill: currentColor;
  stroke: none;
  font-weight: 600;
}
figcaption {
  font-weight: 600;
}

.presenter-preview {
  margin-top: 48px;
}
.preview-output {
  overflow: auto;
  padding: 12px;
  background: var(--card-bg);
  border-radius: 14px;
}
.preview-output > svg {
  display: block;
}
.legend {
  color: #d4c8e1;
  font-size: 0.9rem;
}
details {
  margin-top: 20px;
}
summary {
  cursor: pointer;
}
pre {
  overflow: auto;
  max-height: 420px;
  padding: 16px;
  background: #211d2a;
  border-radius: 10px;
}
</style>

<style>
.preview-output.monochrome-modifiers {
  --modifier-icon-color: currentColor;
}
@media (prefers-color-scheme: dark) {
  .preview-output {
    --modifier-explode-color: var(--modifier-icon-color, #e8b678);
    --modifier-compound-color: var(--modifier-icon-color, #bc9aea);
    --modifier-penetrate-color: var(--modifier-icon-color, #7ac4df);
    --modifier-re-roll-color: var(--modifier-icon-color, #77cbb0);
    --modifier-unique-color: var(--modifier-icon-color, #e89bc6);
    --modifier-min-color: var(--modifier-icon-color, #92bbed);
    --modifier-max-color: var(--modifier-icon-color, #e5c174);
    --modifier-target-success-color: var(--modifier-icon-color, #85d0a1);
    --modifier-target-failure-color: var(--modifier-icon-color, #ed9da7);
    --modifier-critical-success-color: var(--modifier-icon-color, #e8c573);
    --modifier-critical-failure-color: var(--modifier-icon-color, #ed9cbd);
  }
}
</style>
