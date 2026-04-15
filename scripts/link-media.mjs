#!/usr/bin/env node
/**
 * Tworzy symlink: public/exam-all-modules-export.media → data/exam-all-modules-export.media
 * Ścieżki w JSON (./exam-all-modules-export.media/_dedup/...) wtedy trafiają do Vite public i lądują w dist/.
 *
 * Uruchom przed `npm run dev` / `npm run build`, jeśli masz wyeksportowany folder data/*.media/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'data/exam-all-modules-export.media');
const dest = path.join(root, 'public/exam-all-modules-export.media');

if (!fs.existsSync(src)) {
  console.error(
    '[link-media] Brak katalogu źródłowego:\n  ' + src + '\n' +
      'Wyeksportuj media obok JSON (skill export) albo skopiuj folder ręcznie.',
  );
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
const relTarget = path.relative(path.dirname(dest), src);
fs.symlinkSync(relTarget, dest, 'dir');
console.log('[link-media] OK:', dest, '→', relTarget);
