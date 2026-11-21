import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const krslProxy = process.env.VITE_KRSL_TARGET
  ? { "/api/krsl": { target: process.env.VITE_KRSL_TARGET, timeout: 120000, proxyTimeout: 120000 } }
  : {};

export default defineConfig({
  plugins: [react()],
  worker: { format: "es" },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      // The separate KRSL phrase service only when it is actually run locally
      // (VITE_KRSL_TARGET=http://127.0.0.1:5070); otherwise the backend answers
      // "not configured" instead of the dev proxy failing with 502.
      ...krslProxy,
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
      // The separate KRSL phrase service only when it is actually run locally
      // (VITE_KRSL_TARGET=http://127.0.0.1:5070); otherwise the backend answers
      // "not configured" instead of the dev proxy failing with 502.
      ...krslProxy,
      "/api": {
        target: process.env.VITE_API_TARGET || "http://localhost:5050",
        changeOrigin: true,
        timeout: 900000,
        proxyTimeout: 900000,
      },
    },
  },
});
