self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const offline = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#183bbc">
<title>Connection needed | ScopeCheck</title>
<style>
  body{margin:0;background:#f2f5fc;color:#142040;font:1rem/1.6 system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}
  main{max-width:30rem;padding:2rem}
  h1{font:2.5rem/1.05 Georgia,serif;letter-spacing:-.04em}
  p{color:#465470}
  a{display:inline-block;background:#183bbc;color:white;padding:.55rem 1rem;border-radius:.35rem;text-decoration:none}
</style>
<main><strong>ScopeCheck</strong><h1>Connect to open your workspace.</h1>
<p>Your projects are saved on the server. Reconnect to review requests or make changes.</p>
<a href="/">Try again</a></main></html>`;

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || request.mode !== 'navigate' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).catch(() => new Response(offline, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  })));
});
