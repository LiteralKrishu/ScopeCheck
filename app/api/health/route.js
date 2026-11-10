import { appOrigin, authMethods } from '../../../server/config.js';
import { redis } from '../../../server/redis.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  let ready = false;
  try {
    appOrigin();
    const { google, email } = authMethods();
    ready = (google || email) && await redis().ping() === 'PONG';
  } catch {
    // Report readiness without exposing the connection details.
  }
  return Response.json({ status: ready ? 'ready' : 'unavailable' }, {
    status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' },
  });
}
