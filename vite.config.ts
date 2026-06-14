import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** GitHub Pages: w CI `VITE_BASE_PATH=/<nazwa-repo>/` (końcowy slash opcjonalny). Repozytorium `user.github.io` → `/`. */
function pagesBase(): string {
  const p = process.env.VITE_BASE_PATH?.trim();
  if (!p || p === '/') return '/';
  return p.endsWith('/') ? p : `${p}/`;
}
const base = pagesBase();

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: 'spa-fallback-404',
      closeBundle() {
        const dist = resolve(__dirname, 'dist');
        const index = resolve(dist, 'index.html');
        const fallback = resolve(dist, '404.html');
        if (existsSync(index)) copyFileSync(index, fallback);
      },
    },
  ],
  server: {
    port: 5173,
    fs: {
      allow: ['.'],
    },
  },
});
