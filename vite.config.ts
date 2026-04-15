import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** GitHub Pages: w CI `VITE_BASE_PATH=/<nazwa-repo>/` (końcowy slash opcjonalny). Repozytorium `user.github.io` → `/`. */
function pagesBase(): string {
  const p = process.env.VITE_BASE_PATH?.trim();
  if (!p || p === '/') return '/';
  return p.endsWith('/') ? p : `${p}/`;
}
const base = pagesBase();

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: ['.'],
    },
  },
});
