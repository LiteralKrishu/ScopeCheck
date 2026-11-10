import { authenticated, json, readJson } from '../../../server/http.js';
import { createProject, PROJECT_BODY_LIMIT } from '../../../server/project-commands.js';

export const POST = authenticated(async (userId, request) => {
  const { body, raw } = await readJson(request, PROJECT_BODY_LIMIT);
  return json(await createProject(userId, body, raw), 201);
});
