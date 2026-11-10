import { cp, mkdir } from 'node:fs/promises';

const pdf = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const assets = new URL('../public/pdfjs/', import.meta.url);
await mkdir(assets, { recursive: true });
await Promise.all([
  cp(new URL('build/pdf.worker.mjs', pdf), new URL('pdf.worker.mjs', assets)),
  ...['cmaps', 'iccs', 'standard_fonts', 'wasm', 'LICENSE'].map(path =>
    cp(new URL(path, pdf), new URL(path, assets), { recursive: true })),
]);
