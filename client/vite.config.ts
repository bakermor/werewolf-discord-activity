import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  envDir: "../",
  server: {
    port: 3000,
    allowedHosts: ["mistress-eye-opportunities-enable.trycloudflare.com"],
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
    hmr: {
      clientPort: 443,
    },
  },
});
