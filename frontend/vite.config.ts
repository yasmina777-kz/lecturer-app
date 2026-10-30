import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  worker: { format: "es" },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:5050",
        changeOrigin: true,
        timeout: 900000,
        proxyTimeout: 900000,
      },
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:5050",
        changeOrigin: true,
        timeout: 900000,
        proxyTimeout: 900000,
      },
    },
  },
});
