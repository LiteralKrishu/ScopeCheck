import { CATEGORIES, CHANNELS, LIMITS, VERDICTS } from './domain.js';
import { examples } from './demo.js';

const icons = {
  review: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="m8 12 2 2 5-5"/>',
  agreement: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
  log: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8m-8 6h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  clip: '<path d="M8 13l6-6a2.5 2.5 0 1 1 4 4l-8 8a4 4 0 0 1-6-6l8-8"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>',
  data: '<path d="M4 8h16v12H4zM3 4h18v4H3zM9 12h6"/>',
};
export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

export function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

const dates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
const localDates = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const screens = { review: 'Review desk', agreement: 'Agreement', log: 'Change log', record: 'Request details', data: 'Data & examples' };
const statusLabels = { draft: 'Draft', ready: 'Ready to share', shared: 'Awaiting response', approved: 'Approved', declined: 'Declined' };
const methods = { ai: 'AI suggestion', rules: 'Explicit scope match', local: 'Local evidence lookup', fallback: 'AI check unavailable', example: 'Example assessment' };

function dateLabel(value) {
  return (value.length === 10 ? dates : localDates).format(new Date(value));
}

export function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function options(items, selected) {
  return items.map(([key, label]) => `<option value="${escape(key)}"${key === selected ? ' selected' : ''}>${escape(label)}</option>`).join('');
}

const channelOptions = (selected = 'Email') => options(CHANNELS.map(channel => [channel, channel]), selected);
const categories = selected => options(CATEGORIES.map(category => [category, category]), selected);
const errorBox = '<p class="form-error" aria-live="polite" hidden></p>';
const badge = (label, state = '') => `<span class="badge ${state}">${escape(label)}</span>`;
const verdictBadge = verdict => badge(VERDICTS[verdict], verdict);

function button(label, action, style = 'secondary', glyph) {
  return `<button class="button ${style}" type="button" data-action="${action}">${glyph ? icon(glyph) : ''}${label}</button>`;
}
function heading(index, title, copy) {
  return `<div class="page-heading"><p class="eyebrow">${index}</p><h1>${title}</h1><p>${copy}</p></div>`;
}
function panelHead(index, title, copy = '') {
  return `<div class="panel-head"><div><p class="eyebrow">${index}</p><h2>${title}</h2>${copy ? `<p>${copy}</p>` : ''}</div></div>`;
}

export function navigation(projects, project, screen) {
  const links = ['review', 'agreement', 'log', 'data'].map(key =>
    `<button type="button" class="nav-item" data-screen="${key}"${screen === key || key === 'review' && screen === 'record' ? ' aria-current="page"' : ''}>${icon(key)}${screens[key]}</button>`).join('');
  const list = projects.map(item =>
    `<button type="button" class="project-item" data-project="${escape(item.id)}"${item.id === project?.id ? ' aria-current="true"' : ''}><span class="initial" aria-hidden="true">${escape(item.name[0].toUpperCase())}</span><span>${escape(item.name)}</span></button>`).join('');
  return `<div class="brand"><img src="/mark.svg" alt=""><div><strong>ScopeCheck</strong><small>Project workspace</small></div></div>
    <p class="nav-label">Workspace</p><nav aria-label="Workspace">${links}</nav>
    <p class="nav-label">Projects</p><nav aria-label="Projects">${list}
    <button type="button" class="nav-item new-project" data-action="new-project">${icon('plus')}New project</button></nav>
    <div class="side-footer"><strong>${icon('lock')} Browser storage</strong><p>Open this browser to find your project records.</p></div>`;
}

export function topbar(project, screen) {
  return `<div class="crumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>${escape(project?.name ?? screens[screen])}</strong></div><span class="local"><span class="dot"></span> Browser storage</span>`;
}

export function emptyWorkspace() {
  return `${heading('Workspace', 'Start a project', 'Add a project and review the agreement before you check a client request.')}
    <div class="actions">${button('New project', 'new-project', 'primary', 'plus')}${button('Browse examples', 'data', 'secondary', 'data')}</div>`;
}

function agreementSummary(agreement) {
  if (!agreement) return `<section class="panel">${panelHead('02 / Agreement', 'Agreement on file')}
    <p class="muted">Add a signed agreement and review the extracted clauses to begin.</p>
    <div class="section-space">${button('Add agreement', 'agreement', 'secondary', 'agreement')}</div></section>`;
  const counts = CATEGORIES.map(category => [category, agreement.clauses.filter(clause => clause.category === category).length])
    .filter(([, count]) => count > 0);
  return `<section class="panel">${panelHead('02 / Agreement', 'Agreement on file')}
    <div class="agreement-file">${icon('agreement')}<div><strong>${escape(agreement.name)}</strong>
    <span class="hint">${agreement.clauses.length} reviewed clauses</span></div></div>
    <ul class="list reference-list">${counts.map(([category, count]) => `<li><span>${category}</span><span class="ref">${count}</span></li>`).join('')}</ul>
    <div class="section-space">${button('View agreement', 'agreement', 'secondary', 'arrow')}</div></section>`;
}

function recordRow(record) {
  const title = record.message.trim().replace(/\s+/g, ' ');
  return `<li><button class="record-row" type="button" data-record="${record.id}">
    <span><strong>${escape(title)}</strong><span class="hint">${escape(record.channel)} · ${dateLabel(record.date)}</span></span>
    ${record.change ? badge(statusLabels[record.change.status], record.change.status) : record.decision ? verdictBadge(record.decision.verdict) : badge('Needs review', 'unclear')}${icon('arrow')}
    </button></li>`;
}

export function reviewDesk(project, agreement, ai) {
  const requests = project.requests;
  return `<section class="hero">
    <div class="hero-copy"><p class="eyebrow">ScopeCheck / Review desk</p><h1>Review a client request</h1>
    <p>Check the signed agreement, record your decision, and agree on changes before work starts.</p>
    <div class="project-line">${escape(project.name)} ${project.demo ? badge('Example project') : ''}</div></div>
    <div class="stamp"><img src="/mark.svg" alt=""><strong>Scope record</strong>${button('Browse examples', 'data', 'quiet')}</div>
    </section>
    <div class="grid"><div class="stack">
    <section class="panel">${panelHead('01 / New request', 'Capture the request', 'Keep the client’s wording and the date it arrived.')}
      <form id="request-form">
        <div class="fields"><label>Channel<select name="channel">${channelOptions()}</select></label>
        <label>Message date<input name="date" type="date" value="${today()}" required></label></div>
        <label>Client message<textarea name="message" rows="4" maxlength="${LIMITS.request}" placeholder="Could you also add…" required></textarea></label>
        <label>${icon('clip')} Import a message excerpt <span class="optional">TXT</span><input type="file" name="messageFile" accept=".txt,text/plain"></label>
        ${ai ? '<label class="check"><input type="checkbox" name="ai"><span>Use AI for this request. Send the message and reviewed clauses to OpenAI.</span></label>' : ''}
        ${errorBox}
        <div class="actions spread"><button class="button primary" type="submit"${agreement ? '' : ' disabled'}>Check request ${icon('arrow')}</button>
        ${project.demo ? button('Use example message', 'example-message', 'quiet') : ''}</div>
        ${agreement ? '<p class="hint section-space">The result needs your review before you record a decision.</p>' : '<p class="hint section-space">Review an agreement to enable request checks.</p>'}
      </form>
    </section>
    <section class="panel">${panelHead('03 / History', 'Recent requests')}
      ${requests.length ? `<ul class="list">${requests.slice(0, 5).map(recordRow).join('')}</ul>` : '<p class="empty">Your first request will appear here.</p>'}
    </section></div>
    <div class="stack">${agreementSummary(agreement)}</div></div>`;
}

function clauseSource(agreement, clause) {
  return agreement.kind === 'pdf' ? `Page ${clause.page + 1}` : 'Text source';
}
function showClause(agreement, clause) {
  return `<div class="clause"><p class="ref">${clause.id} · ${escape(clause.category)} · ${clauseSource(agreement, clause)}</p>
    <blockquote class="quote">${escape(clause.quote)}</blockquote></div>`;
}
function showCitations(agreement, refs) {
  const citations = refs.map(ref => agreement.clauses.find(clause => clause.id === ref)).filter(Boolean);
  return citations.length ? citations.map(clause => showClause(agreement, clause)).join('') : '<p class="hint section-space">No clauses were selected.</p>';
}

function rawSource(source) {
  return `<details class="section-space"><summary>View source text</summary>${source.pages.map((text, index) =>
    `<p class="ref section-space">${source.kind === 'pdf' ? `Page ${index + 1}` : 'Text source'}</p><pre class="source">${escape(text)}</pre>`).join('')}</details>`;
}

export function clauseEditor(clause, pageCount) {
  return `<div class="review-row">
    <div class="review-row-head"><label class="check"><input type="checkbox" name="keep"${clause.keep === false ? '' : ' checked'}> Keep clause</label>
    <button type="button" class="button quiet danger" data-action="remove-clause">Remove clause</button></div>
    <div class="fields"><label>Category<select name="category">${categories(clause.category)}</select></label>
    <label>Source page<select name="page">${options(Array.from({ length: pageCount }, (_, i) => [String(i), String(i + 1)]), String(clause.page))}</select></label></div>
    <label>Exact quote<textarea name="quote" maxlength="${LIMITS.quote}" rows="2">${escape(clause.quote)}</textarea></label></div>`;
}

export function agreementPage(project, agreement, draft) {
  return `${heading('Project file', 'Agreement', 'Verify the source text and keep the clauses that describe what you agreed to deliver.')}
    <div class="grid">
    <div class="stack">
    <section class="panel">${panelHead('01 / Source', agreement ? 'Add a new version' : 'Add an agreement', 'Upload a PDF with selectable text, upload a TXT file, or paste the verified text.')}
      <form id="agreement-source">
        <label>Agreement file<input type="file" name="file" accept=".pdf,.txt,application/pdf,text/plain"></label>
        <label>Or paste agreement text<textarea name="source" rows="4" maxlength="${LIMITS.agreement}" placeholder="Paste the signed scope of work…"></textarea></label>
        ${errorBox}
        <button class="button primary" type="submit">Extract clauses ${icon('arrow')}</button>
      </form>
    </section>
    ${draft ? `<section id="clause-review" class="panel">${panelHead('02 / Verify', 'Review extracted clauses', 'Choose the clauses to keep. Each quote must match the source page.')}
      <p class="hint">${escape(draft.source.name)} · Up to ${LIMITS.clauses} clauses</p>
      ${rawSource(draft.source)}
      <form id="clause-form" class="section-space">
        <div id="clause-rows">${draft.rows.map(row => clauseEditor(row, draft.source.pages.length)).join('')}</div>
        ${errorBox}
        <div class="actions">${button('Add clause', 'add-clause')}<button class="button primary" type="submit">Save reviewed agreement</button></div>
      </form>
    </section>` : ''}</div>
    <div class="stack"><section class="panel">${panelHead('Current version', 'Reviewed agreement')}
      ${agreement ? `<p class="muted">${escape(agreement.name)}</p><p class="hint">Reviewed ${dateLabel(agreement.reviewedAt)}</p>
      ${agreement.clauses.map(clause => showClause(agreement, clause)).join('')}${rawSource(agreement)}`
      : '<p class="empty">No agreement has been reviewed for this project.</p>'}
      </section>
      <section class="panel"><h3>Project storage</h3><p class="hint">Delete this project and its records from this browser.</p>
        <div class="section-space">${button('Delete project', 'delete-project', 'secondary danger')}</div></section>
    </div></div>`;
}

export function logPage(project) {
  const requests = project.requests;
  const approved = requests.filter(record => record.change?.status === 'approved').length;
  const pending = requests.filter(record => record.change?.status === 'shared').length;
  return `${heading('Project history', 'Change log', 'See the original request, review decision, and written response in one record.')}
    <section class="panel">${panelHead('Records', 'Request history')}
      <div class="log-stats">
        <div><strong>${requests.filter(record => !record.decision || record.decision.verdict === 'unclear').length}</strong><span>Need review</span></div>
        <div><strong>${pending}</strong><span>Awaiting response</span></div>
        <div><strong>${approved}</strong><span>Approved</span></div>
      </div>
      <div class="fields section-space">
        <label>Search requests<input type="search" id="log-filter" maxlength="100" placeholder="Message, channel, or approval"></label>
        <label>Status<select id="log-status">${options([
          ['', 'All statuses'], ['review', 'Needs review'], ['unclear', 'Unclear'],
          ['in', 'In scope'], ['out', 'Out of scope'], ...Object.entries(statusLabels),
        ], '')}</select></label>
      </div>
      <div id="log-results" class="section-space" aria-live="polite">${logRows(requests)}</div>
    </section>`;
}

export function logRows(requests, query = '', status = '') {
  const phrase = query.trim().toLowerCase();
  const matches = requests.filter(record => {
    const state = record.change?.status ?? record.decision?.verdict ?? 'review';
    if (status && state !== status) return false;
    return !phrase || [record.message, record.channel, record.filename, record.date,
      record.decision?.note, record.change?.work, record.change?.response?.text]
      .some(value => value?.toLowerCase().includes(phrase));
  });
  return matches.length ? `<p class="hint form-info">${matches.length} of ${requests.length} requests</p>
    <ul class="list">${matches.map(recordRow).join('')}</ul>`
    : `<p class="empty">${requests.length ? 'No requests match this search.' : 'Requests will appear after the first check.'}</p>`;
}

export function dataPage(project) {
  return `${heading('Workspace tools', 'Data and examples', 'Try a fictional project or move your own project between browsers with a backup.')}
    <div class="stack">
      <section class="panel">${panelHead('01 / Examples', 'Try a workflow', 'Each example opens as a separate project with a reviewed agreement and a sample request.')}
        <div class="example-grid">${Object.entries(examples).map(([key, example]) => `<article>
          <p class="eyebrow">Example project</p><h3>${example.title}</h3><p class="hint">${example.description}</p>
          <button class="button secondary" type="button" data-action="load-example" data-example="${key}">Open ${example.title.toLowerCase()}</button>
        </article>`).join('')}</div>
      </section>
      <div class="grid">
        <section class="panel">${panelHead('02 / Backup', 'Back up the current project')}
          <p class="muted">${project ? `Download all agreement versions, messages, and decisions for <strong>${escape(project.name)}</strong>.`
            : 'Select a project before downloading a backup.'}</p>
          <p class="hint section-space">The file contains readable project data. Store it somewhere private.</p>
          ${project ? `<div class="section-space">${button('Download project backup', 'backup', 'primary', 'download')}</div>` : ''}
        </section>
        <section class="panel">${panelHead('03 / Restore', 'Restore a project', 'Import a backup as a separate project. Existing projects stay in place.')}
          <form id="restore-form"><label>ScopeCheck backup<input type="file" name="backup" accept=".json,application/json" required></label>
            ${errorBox}<button class="button secondary" type="submit">Restore backup</button></form>
        </section>
      </div>
    </div>`;
}

function decisionPanel(record, agreement) {
  const decision = record.decision;
  const history = record.decisionHistory ?? [];
  const historyText = history.length ? `<details class="section-space"><summary>Earlier decisions (${history.length})</summary>
    ${history.map(item => `<div class="clause">${verdictBadge(item.verdict)} <span class="hint">${dateLabel(item.at)}</span>
      ${item.note ? `<p>${escape(item.note)}</p>` : ''}${showCitations(agreement, item.citationIds)}</div>`).join('')}</details>` : '';
  const recorded = decision ? `<section class="panel">${panelHead('03 / Decision', 'Recorded review')}
    ${verdictBadge(decision.verdict)} <span class="hint">${dateLabel(decision.at)}</span>
    ${decision.note ? `<p class="section-space">${escape(decision.note)}</p>` : ''}
    ${showCitations(agreement, decision.citationIds)}${historyText}</section>` : '';
  if (decision && decision.verdict !== 'unclear') return recorded;
  return `${recorded}<section class="panel">${panelHead('03 / Decision', decision ? 'Record a follow-up' : 'Record your decision',
    decision ? 'Add a decision after you clarify the request. The earlier review stays in the record.' : 'Choose the result and the agreement clauses that support it.')}
    <form id="decision-form">
      <label>Decision<select name="verdict">${options(Object.entries(VERDICTS), decision?.verdict ?? record.assessment.verdict)}</select></label>
      <fieldset class="fieldset scroll-evidence"><legend>Supporting clauses</legend>
        ${agreement.clauses.map(clause => `<label class="check"><input type="checkbox" name="citation" value="${clause.id}"${(decision?.citationIds ?? record.assessment.citationIds).includes(clause.id) ? ' checked' : ''}>
        <span><span class="ref">${clause.id} · ${clauseSource(agreement, clause)}</span> ${escape(clause.quote)}</span></label>`).join('')}
      </fieldset>
      <label>Review note <span class="optional">Optional</span><textarea name="note" maxlength="1000" rows="2" placeholder="Add context or a question for the client"></textarea></label>
      ${errorBox}<button class="button primary" type="submit">Record decision</button>
    </form></section>`;
}

function changePanel(record) {
  if (record.decision?.verdict !== 'out') return '';
  const change = record.change;
  if (!change || change.status === 'draft') {
    return `<section class="panel">${panelHead('04 / Change request', 'Prepare a draft', 'Review the description. Set the time impact and price before you mark it ready.')}
      <form id="change-form">
        <label>Requested work<textarea name="work" maxlength="${LIMITS.request}" rows="3" required>${escape(change?.work ?? record.message)}</textarea></label>
        <div class="fields"><label>Time impact<input name="impact" maxlength="500" value="${escape(change?.impact)}" placeholder="2 extra business days"></label>
        <label>Price<input name="price" maxlength="120" value="${escape(change?.price)}" placeholder="Enter amount and currency"></label></div>
        ${errorBox}<div class="actions">
          <button class="button secondary" type="submit" value="draft">Save draft</button>
          <button class="button primary" type="submit" value="ready">Mark ready to share</button></div>
      </form></section>`;
  }
  const response = change.response;
  return `<section class="panel">${panelHead('04 / Change request', 'Change request')}
    ${badge(statusLabels[change.status], change.status)}
    <dl class="terms"><dt>Work</dt><dd>${escape(change.work)}</dd><dt>Time impact</dt><dd>${escape(change.impact)}</dd><dt>Price</dt><dd>${escape(change.price)}</dd></dl>
    <div class="actions">${button('Download draft', 'download', 'secondary', 'download')}
      ${change.status === 'ready' ? button('Edit draft', 'reopen-draft', 'quiet') : ''}</div>
    ${change.status === 'ready' ? `<form id="shared-form" class="section-space">
      <p class="hint form-info">Share the reviewed draft through your own channel. Then record that you shared it.</p>
      ${errorBox}<button class="button primary" type="submit">Mark as shared</button></form>` : ''}
    ${change.status === 'shared' ? `<form id="response-form" class="section-space">
      <div class="fields"><label>Response channel<select name="channel">${channelOptions(record.channel)}</select></label>
      <label>Response date<input name="date" type="date" value="${today()}" required></label></div>
      <label>Written client response<textarea name="response" maxlength="${LIMITS.request}" rows="3" required></textarea></label>
      ${errorBox}<div class="actions"><button class="button primary" type="submit" value="approved">Record approval</button>
      <button class="button secondary" type="submit" value="declined">Record decline</button></div></form>` : ''}
    ${response ? `<div class="section-space"><h3>Client response</h3><p class="hint">${escape(response.channel)} · ${dateLabel(response.date)}</p><blockquote class="quote">${escape(response.text)}</blockquote></div>` : ''}
    <ol class="timeline section-space">
      <li>Draft prepared <span class="hint">· ${dateLabel(change.draftedAt)}</span></li>
      <li>Draft reviewed <span class="hint">· ${dateLabel(change.readyAt)}</span></li>
      ${change.sharedAt ? `<li>Marked shared <span class="hint">· ${dateLabel(change.sharedAt)}</span></li>` : ''}
      ${response ? `<li>${statusLabels[change.status]} recorded <span class="hint">· ${dateLabel(response.recordedAt)}</span></li>` : ''}
    </ol></section>`;
}

export function recordPage(record, agreement) {
  const { assessment } = record;
  return `<div class="actions spread">${button('Back to requests', 'log', 'quiet', 'back')}
    ${button('Export evidence record', 'export-record', 'secondary', 'download')}</div>
    ${heading('Request record', 'Review details', 'The original message and the agreement version used for this check.')}
    <div class="grid"><div class="stack">
    <section class="panel">${panelHead('01 / Client message', 'Original request')}
      <p class="hint">${escape(record.channel)} · ${dateLabel(record.date)}${record.filename ? ` · ${escape(record.filename)}` : ''}</p>
      <blockquote class="quote">${escape(record.message)}</blockquote>
    </section>
    ${decisionPanel(record, agreement)}
    ${changePanel(record)}</div>
    <div class="stack"><section class="panel">${panelHead('02 / Evidence', 'Scope assessment')}
      ${verdictBadge(assessment.verdict)} <span class="hint">${methods[assessment.method]}</span>
      <p class="section-space">${escape(assessment.reason)}</p>
      <div class="agreement-file section-space">${icon('agreement')}<div><strong>${escape(agreement.name)}</strong>
      <span class="hint">Version reviewed ${dateLabel(agreement.reviewedAt)}</span></div></div>
      ${showCitations(agreement, assessment.citationIds)}${rawSource(agreement)}</section></div></div>`;
}
