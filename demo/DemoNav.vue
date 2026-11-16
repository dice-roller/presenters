<script setup lang="ts">
import { presenters } from "./presenters.js";
</script>
<template>
  <nav class="demo-nav" aria-label="Presenter demos">
    <a href="/">All presenters</a>
    <a
      v-for="presenter in presenters"
      :key="presenter.id"
      :href="presenter.href"
      >{{ presenter.name }}</a
    >
  </nav>
</template>
