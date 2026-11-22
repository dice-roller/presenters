<script setup lang="ts">
import { computed, ref } from "vue";
import { Roll, RollHistory, engines } from "@dice-roller/rpg-dice-roller";
import { TerminalPresenter } from "@dice-roller/terminal-presenter";
import DemoNav from "../DemoNav.vue";

const color = ref(true);
const history = new RollHistory();
for (const [notation, seed] of [
  ["4d6kh3 + 2", 1],
  ["{4d10, d20*2, 4+2}d1", 1],
  ["d6! + d8r=1", 21],
  ["4d10>=8=10:2f=1", 10],
] as const) {
  const engine = new engines.EngineRegistry().create("mersenne", seed);
  history.add(new Roll(notation, { engine }));
}

const colours: Partial<Record<number, string>> = {
  31: "#ff8787",
  32: "#8ce99a",
  33: "#ffd43b",
  36: "#66d9e8",
  90: "#b0b3c1",
};

const segments = computed(() => {
  const presenter = new TerminalPresenter({
    color: color.value,
    separator: "\n",
  });
  const output = history.present(presenter);
  const segments = [];
  let intensity = 0;
  let foreground: string | undefined;
  let start = 0;

  for (const match of output.matchAll(/\x1b\[(\d+)m/g)) {
    segments.push({
      text: output.slice(start, match.index),
      intensity,
      foreground,
    });
    start = match.index + match[0].length;
    const code = Number(match[1]);

    switch (code) {
      case 1:
      case 2:
        intensity = code;
        break;
      case 22:
        intensity = 0;
        break;
      default:
        foreground = colours[code];
    }
  }
  segments.push({ text: output.slice(start), intensity, foreground });
  return segments;
});
</script>

<template>
  <main>
    <DemoNav />
    <h1>Terminal presenter</h1>
    <label><input v-model="color" type="checkbox" /> Colour and emphasis</label>
    <pre class="terminal-output"><span
      v-for="(segment, index) in segments"
      :key="index"
      :class="{ bold: segment.intensity === 1, dim: segment.intensity === 2 }"
      :style="{ color: segment.foreground }"
    >{{ segment.text }}</span></pre>
  </main>
</template>

<style scoped>
.terminal-output {
  background: #211d2a;
  color: #ede9f4;
  line-height: 1.7;
}

.bold {
  font-weight: bold;
}

.dim {
  opacity: 0.7;
}
</style>
