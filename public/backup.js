import { CATEGORIES, CHANNELS, LIMITS, VERDICTS, id, validDate, verifyAssessment } from './domain.js';

export const BACKUP_LIMIT = 16 * 1024 * 1024;
const format = 'scopecheck-project';
const safeId = value => typeof value === 'string' && /^[\w-]{1,80}$/.test(value);
const text = (value, max, required = false) =>
  typeof value === 'string' && value.length <= max && (!required || Boolean(value.trim()));
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value));
const uniqueIds = list => new Set(list.map(item => item.id)).size === list.length;

function validAgreement(agreement) {
  if (!agreement || !safeId(agreement.id) || !text(agreement.name, 1024, true)
    || !['pdf', 'text'].includes(agreement.kind) || !timestamp(agreement.reviewedAt)
    || !Array.isArray(agreement.pages) || !agreement.pages.length || agreement.pages.length > LIMITS.pages
    || !agreement.pages.every(page => text(page, LIMITS.agreement))
    || agreement.pages.reduce((total, page) => total + page.length, 0) > LIMITS.agreement
    || !Array.isArray(agreement.clauses) || !agreement.clauses.length || agreement.clauses.length > LIMITS.clauses) return false;
  return agreement.clauses.every(clause => {
    if (!clause || !/^C\d{2,3}$/.test(clause.id) || !CATEGORIES.includes(clause.category)
      || !Number.isInteger(clause.page) || !Number.isInteger(clause.start) || clause.start < 0
      || !text(clause.quote, LIMITS.quote, true)) return false;
    return agreement.pages[clause.page]?.slice(clause.start, clause.start + clause.quote.length) === clause.quote;
  }) && uniqueIds(agreement.clauses);
}

function validDecision(decision, clauses) {
  return Boolean(decision && typeof decision.verdict === 'string' && Object.hasOwn(VERDICTS, decision.verdict) && text(decision.note, 1000)
    && timestamp(decision.at) && Array.isArray(decision.citationIds)
    && decision.citationIds.length <= clauses.length && (decision.verdict === 'unclear' || decision.citationIds.length)
    && decision.citationIds.every(ref => clauses.some(clause => clause.id === ref)));
}

function validChange(change, decision) {
  if (change === null) return true;
  if (decision?.verdict !== 'out' || !change || !text(change.work, LIMITS.request, true)
    || !text(change.impact, 500) || !text(change.price, 120) || !timestamp(change.draftedAt)) return false;
  if (change.status === 'draft') return change.readyAt === null && !change.sharedAt && !change.response;
  if (!change.impact.trim() || !change.price.trim() || !timestamp(change.readyAt)) return false;
  if (change.status === 'ready') return !change.sharedAt && !change.response;
  if (!timestamp(change.sharedAt)) return false;
  if (change.status === 'shared') return !change.response;
  const response = change.response;
  return ['approved', 'declined'].includes(change.status) && response && text(response.text, LIMITS.request, true)
    && validDate(response.date) && CHANNELS.includes(response.channel) && timestamp(response.recordedAt);
}

function validRecord(record, agreements) {
  if (!record || !safeId(record.id) || !text(record.message, LIMITS.request, true) || !validDate(record.date)
    || !CHANNELS.includes(record.channel) || !timestamp(record.createdAt)
    || (record.filename !== null && !text(record.filename, 1024, true))) return false;
  const agreement = agreements.get(record.agreementId);
  if (!agreement || !verifyAssessment(record.assessment, agreement.clauses)
    || !['ai', 'local', 'fallback', 'example', 'rules'].includes(record.assessment.method)) return false;
  const earlier = record.decisionHistory ?? [];
  return (record.decision === null || validDecision(record.decision, agreement.clauses))
    && Array.isArray(earlier) && earlier.length <= 100
    && earlier.every(decision => decision?.verdict === 'unclear' && validDecision(decision, agreement.clauses))
    && validChange(record.change, record.decision);
}

function validProject(project) {
  if (!project || !safeId(project.id) || !text(project.name, 80, true) || !text(project.client, 80)
    || !timestamp(project.createdAt) || !Array.isArray(project.agreements) || !Array.isArray(project.requests)
    || !project.agreements.every(validAgreement) || !uniqueIds(project.agreements)) return false;
  const agreements = new Map(project.agreements.map(agreement => [agreement.id, agreement]));
  return project.requests.every(record => validRecord(record, agreements)) && uniqueIds(project.requests);
}

export function projectBackup(project) {
  const backup = JSON.stringify({ format, version: 1, project });
  if (new TextEncoder().encode(backup).byteLength > BACKUP_LIMIT) throw new Error('This project exceeds the 16 MB backup limit.');
  return backup;
}

export function restoreProject(backup) {
  let document;
  try {
    document = JSON.parse(backup);
  } catch {
    throw new Error('Choose a valid ScopeCheck JSON backup.');
  }
  if (document?.format !== format || document.version !== 1 || !validProject(document.project)) {
    throw new Error('This backup has an unsupported format or invalid agreement evidence.');
  }
  const { project } = document;
  const suffix = ' (restored)';
  return {
    ...project, id: id(), name: project.name.slice(0, 80 - suffix.length) + suffix,
    demo: false, createdAt: new Date().toISOString(),
  };
}
