import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// CATATAN DEPLOY (GitHub Pages):
// - App ini dideploy ke sub-path: https://<username>.github.io/taniku/
// - Maka base produksi = "/taniku/".
// - Untuk development lokal tetap menggunakan "/".
const PROJECT_BASE = "/taniku/";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? PROJECT_BASE : "/",
}));