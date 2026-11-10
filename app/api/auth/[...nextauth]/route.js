import { handlers } from '../../../../auth.js';
import { appOrigin, authMethods } from '../../../../server/config.js';

function available() {
  const methods = authMethods();
  if (!methods.google && !methods.email) return false;
  appOrigin();
  return true;
}

function handle(method) {
  return request => available()
    ? handlers[method](request)
    : Response.json({ error: 'Sign-in is unavailable.' }, { status: 503 });
}

export const GET = handle('GET');
export const POST = handle('POST');
