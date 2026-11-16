<script setup lang="ts">
import DemoNav from "./DemoNav.vue";
import { presenters } from "./presenters.js";
</script>
<template>
  <main>
    <DemoNav />
    <p class="eyebrow">Dice Roller / Presenters</p>
    <h1>Presenter playground</h1>
    <p>
      Choose a presenter to explore its output and appearance options. These
      pages are for local development.
    </p>
    <ul class="presenter-list">
      <li v-for="presenter in presenters" :key="presenter.id">
        <h2>
          <a :href="presenter.href">{{ presenter.name }}</a>
        </h2>
        <code>{{ presenter.packageName }}</code>
        <p>{{ presenter.description }}</p>
      </li>
    </ul>
  </main>
</template>
