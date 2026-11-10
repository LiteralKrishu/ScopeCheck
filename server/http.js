import { currentSession } from '../auth.js';
import { appOrigin } from './config.js';
import { ProjectError } from './projects.js';

export function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function authenticated(handler) {
  return async (request, context) => {
    try {
      if (request.method !== 'GET' && (request.headers.get('origin') !== appOrigin()
        || ['cross-site', 'same-site'].includes(request.headers.get('sec-fetch-site')))) {
        return json({ error: 'Open the ScopeCheck site to make changes.' }, 403);
      }
      const session = await currentSession();
      if (!session?.user?.id) return json({ error: 'Sign in again to open your workspace.' }, 401);
      return await handler(session.user.id, request, context);
    } catch (error) {
      if (error instanceof ProjectError) return json({ error: error.message }, error.status);
      console.error('Workspace operation failed', error.code ?? error.name);
      return json({ error: 'The workspace is temporarily unavailable. Try again.' }, 503);
    }
  };
}

export async function readJson(request, limit) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    throw new ProjectError(415, 'Use a JSON request.');
  }
  if (Number(request.headers.get('content-length')) > limit) {
    throw new ProjectError(413, 'The upload is too large.');
  }
  const chunks = [];
  let bytes = 0;
  if (request.body) {
    for await (const chunk of request.body) {
      bytes += chunk.byteLength;
      if (bytes > limit) throw new ProjectError(413, 'The upload is too large.');
      chunks.push(chunk);
    }
  }
  try {
    const raw = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    return { body: JSON.parse(raw), raw };
  } catch {
    throw new ProjectError(400, 'Choose a valid UTF-8 JSON file or check the request fields.');
  }
}
