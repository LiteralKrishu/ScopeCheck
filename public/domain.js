export const LIMITS = Object.freeze({
  agreement: 100_000, pages: 50, clauses: 100, quote: 1500, request: 8000, file: 8 * 1024 * 1024,
});
export const CATEGORIES = ['Deliverable', 'Exclusion', 'Revision limit', 'Timeline', 'Other'];
export const VERDICTS = { in: 'In scope', out: 'Out of scope', unclear: 'Unclear' };
export const CHANNELS = ['Email', 'WhatsApp', 'Slack', 'Other'];

export function id() {
  return globalThis.crypto.randomUUID();
}

function requireValue(value, message) {
  if (!value) throw new Error(message);
}

function classifyHeading(line) {
  const heading = line.replace(/^\s*(?:\d+[.)]\s*|[-•]\s*)/, '');
  if (/^(?:exclu\w*|out of scope|not included)\b|\b(?:is|are) excluded\b/i.test(heading)) return 'Exclusion';
  if (/^(?:revisions?|feedback|rounds?)\b/i.test(heading)) return 'Revision limit';
  if (/^(?:timeline|schedule|deadline|dates?|milestones?|delivery date)\b/i.test(heading)) return 'Timeline';
  if (/^(?:deliverables?|include[ds]?|in scope|scope of work)\b|\b(?:is|are) included\b/i.test(heading)) return 'Deliverable';
  return null;
}

export function suggestClauses(pages) {
  const suggestions = [];
  let section = 'Other';
  pages.forEach((text, page) => {
    for (const line of text.split('\n')) {
      const quote = line.trim();
      if (!quote) continue;
      const heading = quote.replace(/^\d+[.)]\s*/, '');
      const category = classifyHeading(heading);
      if (category && /^(?:scope of work|deliverables?|in scope|out of scope|exclusions?|revision(?: limits?)?s?|timeline|schedule|milestones?):?$/i.test(heading)) {
        section = category;
        continue;
      }
      if (quote.length <= LIMITS.quote && suggestions.length < LIMITS.clauses) {
        suggestions.push({ page, category: category ?? section, quote });
      }
    }
  });
  return suggestions;
}

export function makeAgreement({ name, kind, pages }, rows) {
  requireValue(Array.isArray(pages) && pages.length > 0 && pages.length <= LIMITS.pages
    && pages.every(page => typeof page === 'string'), 'Use an agreement with readable text within the size limit.');
  const text = pages.join('');
  requireValue(text.trim() && text.length <= LIMITS.agreement, 'Use an agreement with readable text within the size limit.');
  requireValue(rows.length > 0 && rows.length <= LIMITS.clauses, 'Keep between 1 and 100 clauses.');
  const clauses = rows.map(({ page, quote, category }, index) => {
    const start = pages[page]?.indexOf(quote.trim()) ?? -1;
    quote = quote.trim();
    requireValue(quote && quote.length <= LIMITS.quote && start >= 0, 'Each quote must appear exactly on its selected source page.');
    requireValue(CATEGORIES.includes(category), 'Select a valid clause category.');
    return { id: `C${String(index + 1).padStart(2, '0')}`, page, start, quote, category };
  });
  return { id: id(), name, kind, pages, clauses, reviewedAt: new Date().toISOString() };
}

function terms(text) {
  const stop = new Set('a an and are as at be can could do for from i in is it of on or our please the to we with would you your'.split(' '));
  return new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(word => !stop.has(word)));
}

export function findEvidence(message, clauses) {
  const requestTerms = terms(message);
  return clauses.map(clause => ({
    id: clause.id,
    score: [...terms(clause.quote)].filter(term => requestTerms.has(term)).length,
  })).filter(clause => clause.score > 0).sort((left, right) => right.score - left.score)
    .slice(0, 4).map(clause => clause.id);
}

export function localAssessment(message, clauses) {
  const citationIds = findEvidence(message, clauses);
  const subject = requestSubject(message);
  if (subject) {
    const matches = clauses.filter(clause => mentionsSubject(clause.quote, subject));
    const verdicts = matches.map(clause => explicitVerdict(clause, subject));
    if (verdicts.length && verdicts[0] && verdicts.every(verdict => verdict === verdicts[0])) {
      return {
        verdict: verdicts[0], method: 'rules', citationIds: matches.slice(0, 4).map(clause => clause.id),
        reason: 'The request names an item explicitly covered by the quoted scope. Check the agreement before recording your decision.',
      };
    }
  }
  return {
    verdict: 'unclear', citationIds, method: 'local',
    reason: citationIds.length
      ? 'These clauses share words with the request. Compare the original wording and record your decision.'
      : 'No reviewed clause shares a useful term with this request. Check the agreement for related wording before deciding.',
  };
}

function simpleSubject(text) {
  const phrase = text.toLowerCase().trim().replace(/^(?:an?|the)\s+/, '').replace(/\s+/g, ' ');
  return /^[\p{L}\p{N}][\p{L}\p{N} -]{1,79}$/u.test(phrase)
    && !/\b(?:and|or|plus|without|instead|unless|except|if|when|but|only|after|before|subject|with|another|extra|additional|not)\b/.test(phrase)
    ? phrase : null;
}

function requestSubject(message) {
  const match = /^(?:(?:can|could|would) you (?:please )?|please )(?:add|include|build|provide|create|enable) ([^\r\n]+?)[.?!]?$/i.exec(message.trim());
  return match ? simpleSubject(match[1]) : null;
}

function mentionsSubject(quote, subject) {
  const normalized = quote.toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, ' ').trim();
  return ` ${normalized} `.includes(` ${subject} `);
}

function explicitVerdict(clause, subject) {
  const quote = clause.quote.trim().replace(/^(?:\d+[.)]\s*|[-•]\s*)/, '').replace(/\.$/, '');
  const prefix = /^(included|includes|in scope|excluded|excludes|out of scope):\s*(.+)$/i.exec(quote);
  const suffix = /^(.+?)\s+(?:is|are)\s+(included|excluded)(?:\s+(?:in|from) (?:the|this) project)?$/i.exec(quote);
  const scope = (prefix?.[1] ?? suffix?.[2])?.toLowerCase();
  const items = prefix?.[2] ?? suffix?.[1];
  const subjects = items?.split(/,\s*(?:and\s+)?|\s+and\s+/i).map(simpleSubject);
  if (!subjects?.every(Boolean) || !subjects.includes(subject)) return null;
  if (clause.category === 'Deliverable' && ['included', 'includes', 'in scope'].includes(scope)) return 'in';
  if (clause.category === 'Exclusion' && ['excluded', 'excludes', 'out of scope'].includes(scope)) return 'out';
  return null;
}

export function verifyAssessment(candidate, clauses) {
  if (!candidate || typeof candidate.verdict !== 'string' || !Object.hasOwn(VERDICTS, candidate.verdict) || typeof candidate.reason !== 'string'
    || !candidate.reason.trim() || candidate.reason.length > 1200
    || !Array.isArray(candidate.citationIds) || candidate.citationIds.length > 4) return null;
  const citationIds = [...new Set(candidate.citationIds)];
  if (!citationIds.every(ref => clauses.some(clause => clause.id === ref))
    || (candidate.verdict !== 'unclear' && !citationIds.length)) return null;
  return { verdict: candidate.verdict, reason: candidate.reason.trim(), citationIds, method: 'ai' };
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function makeRequest({ message, channel, date, filename }, agreement, assessment) {
  requireValue(message.trim() && message.length <= LIMITS.request, 'Enter a client request of up to 8,000 characters.');
  requireValue(CHANNELS.includes(channel) && validDate(date), 'Enter the message channel and date.');
  return {
    id: id(), message, channel, date, filename,
    agreementId: agreement.id, assessment,
    createdAt: new Date().toISOString(), decision: null, change: null,
  };
}

export function reviewRequest(request, agreement, verdict, citationIds, note, expectedReviewCount = 0) {
  const previous = request.decision;
  const decisionHistory = request.decisionHistory ?? [];
  const reviewCount = decisionHistory.length + Number(Boolean(previous));
  requireValue(reviewCount === expectedReviewCount && (!previous || previous.verdict === 'unclear'),
    'This request already has a newer or final decision.');
  requireValue(decisionHistory.length < 100, 'This request has reached its review limit.');
  requireValue(agreement?.id === request.agreementId && Object.hasOwn(VERDICTS, verdict), 'Select a decision for this agreement version.');
  requireValue(citationIds.every(ref => agreement.clauses.some(clause => clause.id === ref)), 'Choose evidence from the saved agreement.');
  requireValue(verdict === 'unclear' || citationIds.length > 0, 'Select at least one clause before recording a scope decision.');
  requireValue(note.length <= 1000, 'Keep the review note within 1,000 characters.');
  return {
    ...request,
    decision: { verdict, citationIds: [...new Set(citationIds)], note: note.trim(), at: new Date().toISOString() },
    decisionHistory: previous ? [...decisionHistory, previous] : decisionHistory,
  };
}

export function updateChange(request, action, values = {}) {
  const change = request.change;
  const at = new Date().toISOString();
  requireValue(request.decision?.verdict === 'out', 'Record an out-of-scope decision before preparing a change request.');
  if (action === 'draft' || action === 'ready') {
    requireValue(!change || change.status === 'draft', 'Only a draft can be edited.');
    const { work, impact, price } = values;
    requireValue(work?.trim() && work.length <= LIMITS.request, 'Describe the requested work.');
    requireValue(impact.length <= 500 && price.length <= 120, 'Keep the time impact and price brief.');
    if (action === 'ready') requireValue(impact.trim() && price.trim(), 'Set the time impact and price before marking the draft ready.');
    return { ...request, change: {
      work: work.trim(), impact: impact.trim(), price: price.trim(), status: action,
      draftedAt: change?.draftedAt ?? at, readyAt: action === 'ready' ? at : null,
    } };
  }
  if (action === 'shared') {
    requireValue(change?.status === 'ready', 'Review the draft before marking it shared.');
    return { ...request, change: { ...change, status: 'shared', sharedAt: at } };
  }
  if (action === 'reopen') {
    requireValue(change?.status === 'ready', 'Only a ready draft can be reopened.');
    return { ...request, change: { ...change, status: 'draft', readyAt: null } };
  }
  requireValue(change?.status === 'shared' && ['approved', 'declined'].includes(action), 'Mark the change request shared before logging a response.');
  requireValue(validDate(values.date) && CHANNELS.includes(values.channel) && values.response?.trim()
    && values.response.length <= LIMITS.request, 'Enter the client response, channel, and date.');
  return { ...request, change: {
    ...change, status: action,
    response: { text: values.response, date: values.date, channel: values.channel, recordedAt: at },
  } };
}

export function changeText(project, change) {
  const client = project.client ? `\nClient: ${project.client}` : '';
  return `Change request\nProject: ${project.name}${client}\n\nRequested work\n${change.work}\n\nTime impact\n${change.impact}\n\nPrice\n${change.price}\n\nPlease confirm the work, time impact, and price in writing before the additional work begins.\n`;
}

export function recordText(project, record, agreement) {
  const citationText = refs => refs.map(ref => {
    const clause = agreement.clauses.find(item => item.id === ref);
    const page = agreement.kind === 'pdf' ? ` · Page ${clause.page + 1}` : '';
    return `${ref} · ${clause.category}${page}\n${clause.quote}`;
  }).join('\n\n');
  const decisions = [...(record.decisionHistory ?? []), ...(record.decision ? [record.decision] : [])];
  const change = record.change;
  const response = change?.response;
  return [
    `ScopeCheck evidence record\nProject: ${project.name}\nRecord: ${record.id}`,
    `Original request\n${record.date} · ${record.channel}${record.filename ? ` · ${record.filename}` : ''}\n\n${record.message}`,
    `Agreement\n${agreement.name}\nVersion: ${agreement.id}\nReviewed: ${agreement.reviewedAt}`,
    `Assessment\n${VERDICTS[record.assessment.verdict]} · ${record.assessment.method}\n${record.assessment.reason}\n\n${citationText(record.assessment.citationIds)}`,
    ...decisions.map(decision => `Recorded decision\n${VERDICTS[decision.verdict]} · ${decision.at}\n${decision.note}\n\n${citationText(decision.citationIds)}`),
    change && `Change status: ${change.status}\nPrepared: ${change.draftedAt}${change.readyAt ? `\nReviewed: ${change.readyAt}` : ''}${change.sharedAt ? `\nMarked shared: ${change.sharedAt}` : ''}\n\n${changeText(project, change)}`,
    response && `Written response\n${response.date} · ${response.channel}\nRecorded: ${response.recordedAt}\n\n${response.text}`,
  ].filter(Boolean).join('\n\n————\n\n') + '\n';
}
