import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base matches the GitHub Pages project path: zboule.github.io/rent-vs-buy-uae/
export default defineConfig({
  plugins: [react()],
  base: "/rent-vs-buy-uae/",
});
