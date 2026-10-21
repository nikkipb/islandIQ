import { defineConfig } from "vite";
import { resolve } from "node:path";

// `npm run dev` serves the front end with hot reload and forwards /api to
// `npm run api` (wrangler dev on :8788), which runs the Worker + local D1.
const page = (name: string) => resolve(__dirname, `${name}.html`);

export default defineConfig({
  server: { proxy: { "/api": "http://localhost:8788" } },
  build: {
    rollupOptions: {
      input: { main: page("index"), about: page("about"), privacy: page("privacy"), cookies: page("cookies"), terms: page("terms") },
    },
  },
});
