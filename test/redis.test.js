import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { digest, redisAuth } from '../server/auth-adapter.js';
import { createProject, deleteProject, updateProject } from '../server/project-commands.js';
import { getProject, listProjects } from '../server/projects.js';
import { redis } from '../server/redis.js';

const testUrl = process.env.SCOPE_CHECK_TEST_REDIS_URL;
if (testUrl) process.env.REDIS_URL = testUrl;

after(async () => {
  if (testUrl) await redis().quit();
});

test('Redis isolates accounts and rejects concurrent writes to the same revision', { skip: !testUrl }, async () => {
  const owner = randomUUID();
  const other = randomUUID();
  const { project, revision } = await createProject(owner, { kind: 'example', example: 'web' });
  try {
    assert.deepEqual((await listProjects(owner)).map(item => item.id), [project.id]);
    assert.deepEqual(await listProjects(other), []);
    await assert.rejects(getProject(other, project.id), { status: 404 });
    await assert.rejects(deleteProject(other, project.id, { revision }), { status: 404 });

    const request = { kind: 'request', revision, channel: 'Email', date: '2026-11-10', filename: null, ai: false };
    const results = await Promise.allSettled([
      updateProject(owner, project.id, { ...request, message: 'Please add a storefront.' }),
      updateProject(owner, project.id, { ...request, message: 'Could you add online payments?' }),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
    const saved = await getProject(owner, project.id);
    assert.equal(saved.project.requests.length, project.requests.length + 1);
    assert.equal(saved.project.requests[0].agreementId, project.agreements[0].id);
  } finally {
    const current = await getProject(owner, project.id);
    await deleteProject(owner, project.id, { revision: current.revision });
  }
  assert.deepEqual(await listProjects(owner), []);
});

test('Redis sign-in tokens are single-use and signed-out sessions cannot be renewed', { skip: !testUrl }, async () => {
  const identifier = `${randomUUID()}@example.com`;
  const token = randomUUID();
  const expires = new Date(Date.now() + 60_000);
  const user = await redisAuth.createUser({ email: identifier, emailVerified: null });
  const sessionToken = randomUUID();
  try {
    await redisAuth.createVerificationToken({ identifier, token, expires });
    const claims = await Promise.all([
      redisAuth.useVerificationToken({ identifier, token }),
      redisAuth.useVerificationToken({ identifier, token }),
    ]);
    assert.equal(claims.filter(Boolean).length, 1);
    assert.deepEqual(claims.find(Boolean).expires, expires);

    await redisAuth.createSession({ sessionToken, userId: user.id, expires });
    assert.equal((await redisAuth.getSessionAndUser(sessionToken)).user.id, user.id);
    await redisAuth.deleteSession(sessionToken);
    assert.equal(await redisAuth.updateSession({ sessionToken, expires }), null);
    assert.equal(await redisAuth.getSessionAndUser(sessionToken), null);
  } finally {
    await redisAuth.deleteSession(sessionToken);
    await redis().del(`scopecheck:auth:{accounts}:user:${user.id}`, `scopecheck:auth:{accounts}:email:${digest(identifier)}`);
  }
});
