import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, LIMITS } from '../public/domain.js';
import { assess } from './assessment.js';

const PUBLIC_FILES = new Set([
  'index.html', 'styles.css', 'app.js', 'views.js', 'domain.js', 'store.js', 'demo.js', 'backup.js', 'pdf.js', 'mark.svg',
]);
const TYPES = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  svg: 'image/svg+xml', wasm: 'application/wasm',
};
const MAX_BODY = 1_000_000;

function asset(path) {
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (PUBLIC_FILES.has(file)) return new URL(`../public/${file}`, import.meta.url);
  const build = /^\/pdfjs\/(pdf(?:\.worker)?\.mjs)$/.exec(path);
  if (build) return new URL(`../node_modules/pdfjs-dist/build/${build[1]}`, import.meta.url);
  const resource = /^\/pdfjs\/(cmaps|standard_fonts|wasm|iccs)\/([\w-]+\.[\w]+)$/.exec(path);
  if (resource) return new URL(`../node_modules/pdfjs-dist/${resource[1]}/${resource[2]}`, import.meta.url);
  return null;
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readInput(request) {
  const chunks = [];
  let bytes = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) tooLarge = true;
    if (!tooLarge) chunks.push(chunk);
  }
  if (tooLarge) throw new Error('Request too large');
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function validInput(input) {
  const { consent, message, clauses } = input ?? {};
  return consent === true && typeof message === 'string' && message.trim() && message.length <= LIMITS.request
    && Array.isArray(clauses) && clauses.length > 0 && clauses.length <= LIMITS.clauses
    && clauses.every(clause => clause && /^C\d{2,3}$/.test(clause.id)
      && CATEGORIES.includes(clause.category) && typeof clause.quote === 'string'
      && clause.quote.trim() && clause.quote.length <= LIMITS.quote)
    && new Set(clauses.map(clause => clause.id)).size === clauses.length
    && clauses.reduce((total, clause) => total + clause.quote.length, 0) <= LIMITS.agreement;
}

function allowedOrigin(request) {
  const { host, origin } = request.headers;
  return /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host ?? '')
    && origin === `http://${host}`
    && ['same-origin', undefined].includes(request.headers['sec-fetch-site']);
}

export function makeServer({ key, model = 'gpt-4.1-mini', fetcher = fetch } = {}) {
  let assessing = false;
  return createServer({ requestTimeout: 25_000 }, async (request, response) => {
    const path = request.url?.split('?')[0] ?? '';
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; worker-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (request.method === 'GET' && path === '/api/config') return json(response, 200, { ai: Boolean(key) });

    if (request.method === 'POST' && path === '/api/assess') {
      if (!key) return json(response, 503, { error: 'AI is disabled on this server.' });
      if (!allowedOrigin(request)) return json(response, 403, { error: 'Use the local ScopeCheck workspace.' });
      if (request.headers['content-type']?.split(';')[0] !== 'application/json') return json(response, 415, { error: 'Expected JSON.' });
      if (Number(request.headers['content-length']) > MAX_BODY) return json(response, 413, { error: 'Request too large.' });
      let input;
      try {
        input = await readInput(request);
      } catch {
        return json(response, 400, { error: 'The request body is invalid or too large.' });
      }
      if (!validInput(input)) return json(response, 400, { error: 'A request, reviewed clauses, and consent are required.' });
      if (assessing) return json(response, 429, { error: 'Another AI check is in progress. Try again when it finishes.' });
      assessing = true;
      try {
        const clauses = input.clauses.map(({ id, category, quote }) => ({ id, category, quote }));
        return json(response, 200, await assess({ message: input.message, clauses }, { key, model, fetcher }));
      } finally {
        assessing = false;
      }
    }

    const file = ['GET', 'HEAD'].includes(request.method) && asset(path);
    if (file) {
      try {
        const info = await stat(file);
        const type = TYPES[file.pathname.split('.').at(-1)] ?? 'application/octet-stream';
        response.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size });
        if (request.method === 'HEAD') return response.end();
        createReadStream(file).on('error', () => response.destroy()).pipe(response);
        return;
      } catch {
        // Unknown assets fall through to a 404.
      }
    }
    return json(response, 404, { error: 'Not found.' });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(host);
  makeServer({
    key: loopback ? process.env.OPENAI_API_KEY?.trim() : undefined,
    model: process.env.OPENAI_MODEL || undefined,
  }).listen(port, host, () => {
    const address = host === '::1' ? '[::1]' : host;
    console.log(`ScopeCheck is running at http://${address}:${port}`);
  });
}
