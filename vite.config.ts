import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore local dev plugin is authored as ESM JavaScript for Vite.
import { localDreamsPlugin } from './vite.local-dreams-plugin.mjs';

export default defineConfig({
  plugins: [react(), localDreamsPlugin()],
  server: {
    port: 5173,
  },
});
