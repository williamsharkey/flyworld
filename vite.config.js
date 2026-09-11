import { defineConfig } from "vite";
export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? "/flyworld/" : "/",
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
}));
