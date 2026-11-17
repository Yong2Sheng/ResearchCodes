/**
 * Build a fully self-contained, offline HTML file.
 *
 * Three.js, its Line2 addons, all app modules and the validation functions are
 * bundled into one classic <script> tag. The resulting event-cone-rotation.html can be opened
 * by double-clicking; no local server or network connection is required.
 * Math notation is typeset with KaTeX, whose CSS and WOFF2 fonts are inlined.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { inlineMathStyles } from './build-math-assets.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(root, 'src', 'event-cone-rotation.template.html');
const outputPath = path.join(root, 'event-cone-rotation.html');

const result = await build({
  entryPoints: [path.join(root, 'src', 'app.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome100', 'safari15', 'firefox102'],
  legalComments: 'none',
  write: false,
  logLevel: 'info',
  banner: {
    js: '/* Compton telescope real-space visualization — bundled from src/. */',
  },
});

const bundle = result.outputFiles[0].text;
const template = await inlineMathStyles(await fs.readFile(templatePath, 'utf8'));
const marker = '/*__APP_BUNDLE__*/';
if (!template.includes(marker)) {
  throw new Error(`Template is missing the ${marker} marker.`);
}
// Guard against an accidental literal closing script sequence inside JS.
const safeBundle = bundle.replaceAll('</script', '<\\/script');
const html = template.replace(marker, () => safeBundle);
await fs.writeFile(outputPath, html, 'utf8');

const stats = await fs.stat(outputPath);
console.log(`Built ${path.relative(root, outputPath)} (${(stats.size / 1024).toFixed(1)} KiB, self-contained)`);
