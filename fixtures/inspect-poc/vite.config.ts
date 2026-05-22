import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pdmInspect from '@shinjinseop/page-dep-map-vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    pdmInspect({
      baseUrl: 'http://localhost:3399',
    }),
  ],
});
