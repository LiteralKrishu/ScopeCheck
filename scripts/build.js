import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const source = new URL('../public/', import.meta.url);
const output = new URL('../dist/', import.meta.url);
const pdf = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
await rm(output, { recursive: true, force: true });
await cp(source, output, { recursive: true });

const index = new URL('index.html', output);
const html = (await readFile(index, 'utf8'))
  .replace('<html lang="en">', '<html lang="en" data-hosted="true">')
  .replace('<head>', `<head>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; worker-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'">
  <meta name="referrer" content="no-referrer">`);
await writeFile(index, html);
await writeFile(new URL('release.json', output), JSON.stringify({ version }) + '\n');

const assets = new URL('pdfjs/', output);
await mkdir(assets);
await Promise.all([
  cp(new URL('build/pdf.mjs', pdf), new URL('pdf.mjs', assets)),
  cp(new URL('build/pdf.worker.mjs', pdf), new URL('pdf.worker.mjs', assets)),
  ...['cmaps', 'iccs', 'standard_fonts', 'wasm', 'LICENSE'].map(path =>
    cp(new URL(path, pdf), new URL(path, assets), { recursive: true })),
]);
console.log(`ScopeCheck ${version} built in dist/`);
