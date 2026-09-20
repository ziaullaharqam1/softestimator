import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { livePricesPlugin } from "./server/livePrices.mjs";

export default defineConfig({
  plugins: [react(), livePricesPlugin()],
  server: { port: 5173, host: true },
});
