import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./demo", import.meta.url)),
  plugins: [vue()],
  server: { host: "127.0.0.1" },
  preview: { host: "127.0.0.1" },
  build: {
    outDir: fileURLToPath(new URL("./demo-dist", import.meta.url)),
    emptyOutDir: true,
  },
});
