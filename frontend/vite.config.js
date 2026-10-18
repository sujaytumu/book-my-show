import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Every build gets a unique id. It is baked into the app and also written to /version.json, so the running
// app can notice when a newer build has been deployed and offer to reload.
const BUILD_ID = String(Date.now());

export default defineConfig({
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [
    react(),
    {
      name: "emit-version",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ id: BUILD_ID }) });
      },
    },
  ],
});
