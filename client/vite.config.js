import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on the LAN, not just localhost, so phones on the same WiFi can reach it
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
