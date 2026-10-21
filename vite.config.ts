import { defineConfig } from "vite";

// `npm run dev` serves the front end with hot reload and forwards /api to
// `npm run api` (wrangler pages dev on :8788), which runs the Functions + local D1.
export default defineConfig({
  server: { proxy: { "/api": "http://localhost:8788" } },
});
