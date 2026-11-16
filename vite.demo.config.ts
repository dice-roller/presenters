import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const demoRoot = fileURLToPath(new URL("./demo", import.meta.url));
const pages = Object.fromEntries([
  ["index", `${demoRoot}/index.html`],
  ...readdirSync(demoRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(`${demoRoot}/${entry.name}/index.html`),
    )
    .map((entry) => [entry.name, `${demoRoot}/${entry.name}/index.html`]),
]);

export default defineConfig({
  root: demoRoot,
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: /^@dice-roller\/svg-presenter$/,
        replacement: fileURLToPath(
          new URL("./packages/svg/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  build: {
    outDir: fileURLToPath(new URL("./demo-dist", import.meta.url)),
    emptyOutDir: true,
    rolldownOptions: { input: pages },
  },
});
