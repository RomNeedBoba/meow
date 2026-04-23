import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    proxy: {
      "/api": "http://localhost:5000",
      "/audio": "http://localhost:8000",
    },
  },
});