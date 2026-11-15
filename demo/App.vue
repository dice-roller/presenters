<script setup lang="ts">
import { ref } from "vue";
import { fillValueSlot } from "../src/svg/value-slot.js";
import d2 from "../assets/dice/d2.svg?raw";
import d4 from "../assets/dice/d4.svg?raw";
import d6 from "../assets/dice/d6.svg?raw";
import d8 from "../assets/dice/d8.svg?raw";
import d10 from "../assets/dice/d10.svg?raw";
import d12 from "../assets/dice/d12.svg?raw";
import d20 from "../assets/dice/d20.svg?raw";
import generic from "../assets/dice/generic.svg?raw";

const stroke = ref("#7962b5");
const fill = ref("#eee7fb");
const filled = ref(false);
const showValues = ref(true);
const sizes = { "x-small": 40, small: 80, medium: 140, large: 200, "x-large": 400 } as const;
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
          <option v-for="(_value, name) in sizes" :value="name">{{ name }}</option>
        </select>
      </label>
      <label>Outline colour <input v-model="stroke" type="color" /></label>
      <label>Fill colour <input v-model="fill" type="color" /></label>
      <label><input v-model="filled" type="checkbox" /> Fill dice</label>
      <label><input v-model="showValues" type="checkbox" /> Show values</label>
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
        <figcaption>{{ icon.label }}</figcaption>
      </figure>
    </section>
  </main>
</template>

<style>
:root {
  --die-size: 140px;
  --die-fill: none;

  font-family: system-ui, sans-serif;
  color: #ede9f4;
  background: #17151e;
  color-scheme: dark;
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
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
  margin: 28px 0;
  padding: 20px;
  border: 1px solid #655970;
  border-radius: 12px;
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
  background: #fff;
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
</style>
