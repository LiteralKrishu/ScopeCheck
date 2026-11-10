import { z } from 'zod';
import { BACKUP_LIMIT, restoreProject } from '../lib/backup.js';
import { createExample } from '../lib/demo.js';
import {
  CATEGORIES, CHANNELS, LIMITS, VERDICTS, id, localAssessment, makeAgreement, makeRequest, reviewRequest, updateChange, validDate,
} from '../lib/domain.js';
import { assess } from './assessment.js';
import { ProjectError, getProject, writeProject } from './projects.js';
import { incrementWindow } from './redis.js';

export const PROJECT_BODY_LIMIT = BACKUP_LIMIT;
export const PROJECT_UPDATE_LIMIT = 1_500_000;
export const projectIdSchema = z.string().regex(/^[\w-]{1,80}$/);
const nonEmpty = max => z.string().max(max).refine(value => Boolean(value.trim()));
const date = z.string().refine(validDate);
const revision = z.uuid();
const createdProject = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('new'), name: nonEmpty(80), client: z.string().max(80) }),
  z.object({ kind: z.literal('example'), example: z.enum(['web', 'studio', 'operations']) }),
]);
const action = z.discriminatedUnion('action', [
  z.object({
    action: z.enum(['draft', 'ready']), work: nonEmpty(LIMITS.request),
    impact: z.string().max(500), price: z.string().max(LIMITS.price), currency: z.string().max(3),
  }),
  z.object({ action: z.enum(['shared', 'reopen']) }),
  z.object({ action: z.enum(['approved', 'declined']), channel: z.enum(CHANNELS), date, response: nonEmpty(LIMITS.request) }),
]);
const projectCommand = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('agreement'), revision,
    source: z.object({
      name: nonEmpty(1024), kind: z.enum(['pdf', 'text']),
      pages: z.array(z.string().max(LIMITS.agreement)).min(1).max(LIMITS.pages),
    }).refine(source => source.pages.reduce((total, page) => total + page.length, 0) <= LIMITS.agreement),
    rows: z.array(z.object({
      page: z.number().int().min(0).max(LIMITS.pages - 1), quote: nonEmpty(LIMITS.quote), category: z.enum(CATEGORIES),
    })).min(1).max(LIMITS.clauses),
  }),
  z.object({
    kind: z.literal('request'), revision, message: nonEmpty(LIMITS.request),
    channel: z.enum(CHANNELS), date, filename: nonEmpty(1024).nullable(), ai: z.boolean(),
  }).strict(),
  z.object({
    kind: z.literal('decision'), revision, recordId: projectIdSchema, verdict: z.enum(Object.keys(VERDICTS)),
    citationIds: z.array(z.string().regex(/^C\d{2,3}$/)).max(LIMITS.clauses), note: z.string().max(1000),
  }),
  z.object({ kind: z.literal('change'), revision, recordId: projectIdSchema, values: action }),
]);

function input(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) throw new ProjectError(400, 'Check the required fields and their limits.');
  return result.data;
}

function fromDomain(update) {
  try {
    return update();
  } catch (error) {
    throw new ProjectError(400, error.message);
  }
}

export async function createProject(userId, body, raw) {
  if (body?.format === 'scopecheck-project') {
    return writeProject(userId, fromDomain(() => restoreProject(raw)));
  }
  const command = input(createdProject, body);
  const project = command.kind === 'example' ? createExample(command.example) : {
    id: id(), name: command.name.trim(), client: command.client.trim(),
    createdAt: new Date().toISOString(), agreements: [], requests: [],
  };
  return writeProject(userId, project);
}

async function assessRequest(userId, command, agreement) {
  const { message, ai } = command;
  if (!ai) return localAssessment(message, agreement.clauses);
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new ProjectError(503, 'AI checks are unavailable. Clear the AI option to run a local check.');
  if (await incrementWindow(`ai:${userId}`, 60 * 60) > 10
    || await incrementWindow('ai:total', 60 * 60) > 120) {
    throw new ProjectError(429, 'The hourly AI limit was reached. Clear the AI option to run a local check.');
  }
  const clauses = agreement.clauses.map(({ id, category, quote }) => ({ id, category, quote }));
  return assess({ message, clauses }, { key, model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', fetcher: fetch });
}

export async function updateProject(userId, projectId, body) {
  const command = input(projectCommand, body);
  const { project, revision } = await getProject(userId, projectId);
  if (revision !== command.revision) throw new ProjectError(409, 'This project changed in another session. Reload it before trying again.');
  let recordId;
  if (command.kind === 'agreement') {
    project.agreements.push(fromDomain(() => makeAgreement(command.source, command.rows)));
  } else if (command.kind === 'request') {
    const agreement = project.agreements.at(-1);
    if (!agreement) throw new ProjectError(400, 'Review an agreement before checking a request.');
    const assessment = await assessRequest(userId, command, agreement);
    const record = fromDomain(() => makeRequest(command, agreement, assessment));
    recordId = record.id;
    project.requests.unshift(record);
  } else {
    const index = project.requests.findIndex(record => record.id === command.recordId);
    if (index < 0) throw new ProjectError(404, 'Request not found.');
    const record = project.requests[index];
    if (command.kind === 'decision') {
      const agreement = project.agreements.find(item => item.id === record.agreementId);
      const count = (record.decisionHistory?.length ?? 0) + Number(Boolean(record.decision));
      project.requests[index] = fromDomain(() =>
        reviewRequest(record, agreement, command.verdict, command.citationIds, command.note, count));
    } else {
      project.requests[index] = fromDomain(() => updateChange(record, command.values.action, command.values));
    }
  }
  return { ...await writeProject(userId, project, revision), recordId };
}

export function deleteProject(userId, projectId, body) {
  const command = input(z.object({ revision }), body);
  return writeProject(userId, null, command.revision, projectId);
}
