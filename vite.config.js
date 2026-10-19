import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves this project below /platform/; relative asset URLs
  // also keep the same build usable from Cloudflare Pages and local preview.
  base: './',
});
