import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const mockPort = Number(process.env.FLEET_E2E_PORT ?? 3100);
const webPort = Number(process.env.FLEET_E2E_WEB_PORT ?? 4173);
const mockServer = `http://127.0.0.1:${mockPort}`;

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  cacheDir: fileURLToPath(new URL('../node_modules/.vite-e2e', import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: webPort,
    strictPort: true,
    proxy: {
      '/api': mockServer,
      '/ws': { target: mockServer, ws: true },
    },
  },
});
