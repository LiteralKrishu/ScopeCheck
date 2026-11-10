export function appOrigin() {
  const url = new URL(process.env.AUTH_URL ?? 'http://localhost:3000');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw new Error('AUTH_URL must be an HTTPS origin or a local HTTP origin.');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_URL) {
    throw new Error('Set AUTH_URL to the production origin.');
  }
  return url.origin;
}

export function authMethods() {
  const configured = Boolean(process.env.AUTH_SECRET?.length >= 32 && process.env.REDIS_URL);
  return {
    google: configured && Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    email: configured && Boolean(process.env.AUTH_RESEND_KEY && process.env.AUTH_EMAIL_FROM),
  };
}
