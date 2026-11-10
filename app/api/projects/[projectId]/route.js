import { authenticated, json, readJson } from '../../../../server/http.js';
import { deleteProject, PROJECT_UPDATE_LIMIT, projectIdSchema, updateProject } from '../../../../server/project-commands.js';
import { getProject, ProjectError } from '../../../../server/projects.js';

async function projectIdFrom(context) {
  const result = projectIdSchema.safeParse((await context.params).projectId);
  if (!result.success) throw new ProjectError(404, 'Project not found.');
  return result.data;
}

export const GET = authenticated(async (userId, _, context) =>
  json(await getProject(userId, await projectIdFrom(context))));

export const PATCH = authenticated(async (userId, request, context) => {
  const projectId = await projectIdFrom(context);
  const { body } = await readJson(request, PROJECT_UPDATE_LIMIT);
  return json(await updateProject(userId, projectId, body));
});

export const DELETE = authenticated(async (userId, request, context) => {
  const projectId = await projectIdFrom(context);
  const { body } = await readJson(request, 1024);
  await deleteProject(userId, projectId, body);
  return json({ deleted: true });
});
