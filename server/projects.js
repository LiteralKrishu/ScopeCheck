import { id } from '../lib/domain.js';
import { BACKUP_LIMIT } from '../lib/backup.js';
import { redis } from './redis.js';

const indexKey = userId => `scopecheck:projects:{${userId}}:index`;
const projectKey = (userId, projectId) => `scopecheck:projects:{${userId}}:project:${projectId}`;

export class ProjectError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function listProjects(userId) {
  const entries = await redis().hvals(indexKey(userId));
  return entries.map(entry => JSON.parse(entry)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProject(userId, projectId) {
  const raw = await redis().get(projectKey(userId, projectId));
  if (!raw) throw new ProjectError(404, 'Project not found.');
  return JSON.parse(raw);
}

export async function writeProject(userId, project, expected = '', projectId = project.id) {
  const revision = id();
  const raw = project ? JSON.stringify({ revision, project }) : '';
  if (Buffer.byteLength(raw) > BACKUP_LIMIT) throw new ProjectError(413, 'This project has reached the 16 MB size limit.');
  const summary = project ? JSON.stringify({ id: project.id, name: project.name, createdAt: project.createdAt }) : '';
  const result = await redis().eval(`
    local current = redis.call('GET', KEYS[1])
    if ARGV[1] == '' then
      if current then return 409 end
      if redis.call('HLEN', KEYS[2]) >= 100 then return 422 end
    else
      if not current then return 404 end
      if cjson.decode(current).revision ~= ARGV[1] then return 409 end
    end
    if ARGV[2] == '' then
      redis.call('HDEL', KEYS[2], ARGV[3])
      redis.call('DEL', KEYS[1])
    else
      redis.call('HSET', KEYS[2], ARGV[3], ARGV[4])
      redis.call('SET', KEYS[1], ARGV[2])
    end
    return 200
  `, 2, projectKey(userId, projectId), indexKey(userId), expected, raw, projectId, summary);
  if (result === 409) throw new ProjectError(409, 'This project changed in another session. Reload it before trying again.');
  if (result === 404) throw new ProjectError(404, 'Project not found.');
  if (result === 422) throw new ProjectError(422, 'Your workspace can hold up to 100 projects.');
  return project ? { revision, project } : null;
}
