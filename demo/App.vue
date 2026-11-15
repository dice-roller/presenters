<template>
  <main>
    <p class="eyebrow">Dice Roller / Presenters</p>
    <h1>Local presenter playground</h1>
    <p>
      The project is ready for its first SVG presenter. Its generated output
      will appear here once implemented.
    </p>
    <section aria-labelledby="preview-heading">
      <h2 id="preview-heading">SVG preview</h2>
      <div class="placeholder">SVG presenter coming next</div>
    </section>
  </main>
</template>

<style>
:root {
  font-family: system-ui, sans-serif;
  color: #ede9f4;
  background: #17151e;
  color-scheme: dark;
}
body {
  margin: 0;
}
main {
  max-width: 960px;
  margin: 0 auto;
  padding: 64px 24px;
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
  max-width: 65ch;
}
section {
  margin-top: 40px;
  padding: 24px;
  border: 1px solid #494052;
  border-radius: 16px;
}
h2 {
  margin-top: 0;
  font-size: 1.1rem;
}
.placeholder {
  display: grid;
  place-items: center;
  min-height: 240px;
  border: 1px dashed #655970;
  border-radius: 10px;
  color: #bcb1c8;
}
</style>
