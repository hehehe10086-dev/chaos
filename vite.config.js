import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { apiDevServer } from './dev/vite-api-plugin.js';

export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevServer()],
  server: {
    // Listen on the LAN too, so a phone on the same Wi-Fi can open the dev server.
    host: true,
  },
});
