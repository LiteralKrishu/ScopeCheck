import {
  LIMITS, changeText, id, localAssessment, makeAgreement, makeRequest, recordText, reviewRequest,
  suggestClauses, updateChange, validDate,
} from './domain.js';
import { BACKUP_LIMIT, projectBackup, restoreProject } from './backup.js';
import { createExample, demoMessage, examples } from './demo.js';
import { readAgreement, readUtf8File } from './pdf.js';
import { listProjects, writeProject } from './store.js';
import {
  agreementPage, clauseEditor, dataPage, emptyWorkspace, logPage, logRows, navigation, recordPage, reviewDesk, topbar,
} from './views.js';

const sidebar = document.querySelector('#sidebar');
const main = document.querySelector('#main');
const header = document.querySelector('#topbar');
const dialog = document.querySelector('#project-dialog');
const notice = document.querySelector('#notice');

let projects = [];
let displayedProject;
let ai = false;
let projectId = sessionStorage.getItem('scopecheck.project');
let screen = 'review';
let requestId = null;
let draft = null;
let importedFile = null;
let pendingImport = null;
let noticeTimer;

const activeProject = () => projects.find(project => project.id === projectId);
const activeRecord = project => project?.requests.find(record => record.id === requestId);
const latestAgreement = project => project?.agreements.at(-1);

function render(focus = false) {
  const project = activeProject();
  const agreement = latestAgreement(project);
  const record = activeRecord(project);
  if (screen === 'record' && !record) screen = 'log';
  sidebar.innerHTML = navigation(projects, project, screen);
  header.innerHTML = topbar(project, screen);
  importedFile = null;
  if (screen === 'data') main.innerHTML = dataPage(project);
  else if (!project) main.innerHTML = emptyWorkspace();
  else if (screen === 'agreement') main.innerHTML = agreementPage(project, agreement, draft);
  else if (screen === 'log') main.innerHTML = logPage(project);
  else if (screen === 'record') main.innerHTML = recordPage(record, project.agreements.find(item => item.id === record.agreementId));
  else main.innerHTML = reviewDesk(project, agreement, ai);
  // A background save can refresh projects without redrawing this screen.
  displayedProject = project;
  if (focus) {
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function navigate(next, nextRecord = null) {
  if (screen === next && requestId === nextRecord) return;
  screen = next;
  requestId = nextRecord;
  draft = null;
  render(true);
}

function chooseProject(next, nextScreen) {
  projectId = next;
  if (next) sessionStorage.setItem('scopecheck.project', next);
  else sessionStorage.removeItem('scopecheck.project');
  requestId = null;
  draft = null;
  screen = nextScreen;
  render(true);
}

function showNotice(message) {
  clearTimeout(noticeTimer);
  notice.textContent = message;
  notice.hidden = false;
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 4600);
}

function formError(form, message = '') {
  const element = form.querySelector('.form-error');
  element.textContent = message;
  element.hidden = !message;
}

function downloadFile(name, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readClauseRows() {
  return [...document.querySelectorAll('#clause-rows .review-row')].map(row => ({
    page: Number(row.querySelector('[name="page"]').value),
    quote: row.querySelector('[name="quote"]').value,
    category: row.querySelector('[name="category"]').value,
    keep: row.querySelector('[name="keep"]').checked,
  }));
}

async function saveProject(projectId, update) {
  await writeProject(projectId, project => {
    if (!project) throw new Error('This project is no longer in this browser.');
    return update(project);
  });
  projects = await listProjects();
}

async function saveRecord(projectId, recordId, update) {
  await saveProject(projectId, project => {
    const index = project.requests.findIndex(record => record.id === recordId);
    if (index < 0) throw new Error('This request is no longer in this project.');
    project.requests[index] = update(project.requests[index], project);
    return project;
  });
}

function saveChange(project, record, action, values) {
  return saveRecord(project.id, record.id, current => updateChange(current, action, values, record.change));
}

const actions = {
  'new-project'() {
    dialog.querySelector('form').reset();
    formError(dialog.querySelector('form'));
    dialog.showModal();
  },
  'close-dialog'() { dialog.close(); },
  data() { navigate('data'); },
  agreement() { navigate('agreement'); },
  log() { navigate('log'); },
  'example-message'() {
    const field = main.querySelector('[name="message"]');
    field.value = examples[activeProject().example]?.message ?? demoMessage;
    main.querySelector('[name="messageFile"]').value = '';
    importedFile = null;
    field.focus();
  },
  async 'load-example'(button) {
    const key = button.dataset.example;
    if (!Object.hasOwn(examples, key)) return;
    button.disabled = true;
    try {
      const project = createExample(key);
      await writeProject(project.id, () => project);
      projects = await listProjects();
      chooseProject(project.id, 'review');
      showNotice('Example project added.');
    } finally {
      button.disabled = false;
    }
  },
  backup() {
    const project = activeProject();
    if (!project) return;
    downloadFile(`scopecheck-project-${project.id}.json`, projectBackup(project), 'application/json');
    showNotice('Project backup downloaded.');
  },
  'export-record'() {
    const project = displayedProject;
    const record = activeRecord(project);
    if (!record) return;
    const agreement = project.agreements.find(item => item.id === record.agreementId);
    downloadFile(`scopecheck-record-${record.id.slice(0, 8)}.txt`, recordText(project, record, agreement));
  },
  async 'reopen-draft'() {
    const project = displayedProject;
    const record = activeRecord(project);
    await saveChange(project, record, 'reopen');
    if (projectId === project.id && requestId === record.id) render(true);
    showNotice('Draft reopened for editing.');
  },
  'add-clause'() {
    const rows = document.querySelector('#clause-rows');
    if (rows.children.length >= LIMITS.clauses) {
      formError(rows.closest('form'), 'Remove a clause before adding another.');
      return;
    }
    rows.insertAdjacentHTML('beforeend', clauseEditor({ page: 0, category: 'Other', quote: '' }, draft.source.pages.length));
    rows.lastElementChild.querySelector('textarea').focus();
  },
  'remove-clause'(button) {
    const row = button.closest('.review-row');
    const next = row.nextElementSibling ?? row.previousElementSibling;
    row.remove();
    (next?.querySelector('textarea') ?? document.querySelector('[data-action="add-clause"]')).focus();
  },
  async 'delete-project'() {
    const project = activeProject();
    if (!project || !window.confirm(`Delete “${project.name}” and all its records from this browser?`)) return;
    await writeProject(project.id, () => null);
    projects = await listProjects();
    if (projectId === project.id) chooseProject(projects[0]?.id, 'review');
    showNotice('Project deleted.');
  },
  download() {
    const project = displayedProject;
    const record = activeRecord(project);
    if (!record?.change?.readyAt) return;
    downloadFile(`scopecheck-change-${record.id.slice(0, 8)}.txt`, changeText(project, record.change));
  },
};

document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  try {
    if (button.dataset.screen) navigate(button.dataset.screen);
    else if (button.dataset.project && button.dataset.project !== projectId) chooseProject(button.dataset.project, 'review');
    else if (button.dataset.record) navigate('record', button.dataset.record);
    else if (button.dataset.action) await actions[button.dataset.action]?.(button);
  } catch (error) {
    showNotice(error.message);
  }
});

document.addEventListener('change', async event => {
  const input = event.target;
  if (input.id === 'log-status') updateLog();
  if (input.name !== 'messageFile') return;
  const form = input.form;
  const file = input.files[0];
  formError(form);
  if (!file) return;
  if (!/\.txt$/i.test(file.name) || file.size > LIMITS.request * 4) {
    input.value = '';
    formError(form, 'Choose a UTF-8 TXT excerpt of up to 8,000 characters.');
    return;
  }
  const task = readUtf8File(file);
  pendingImport = task;
  const field = form.elements.message;
  const previous = field.value;
  try {
    const message = await task;
    if (!form.isConnected || input.files[0] !== file || field.value !== previous) return;
    if (!message.trim() || message.length > LIMITS.request || message.includes('\0')) {
      throw new Error('Choose a plain-text excerpt of up to 8,000 characters.');
    }
    field.value = message;
    importedFile = { name: file.name, text: field.value, original: message };
  } catch (error) {
    if (input.files[0] === file) {
      input.value = '';
      formError(form, error.message);
    }
  } finally {
    if (pendingImport === task) pendingImport = null;
  }
});

function updateLog() {
  const filter = document.querySelector('#log-filter');
  const project = activeProject();
  if (!filter || !project) return;
  document.querySelector('#log-results').innerHTML = logRows(project.requests, filter.value, document.querySelector('#log-status').value);
}

document.addEventListener('input', event => {
  if (event.target.id === 'log-filter') updateLog();
});

async function checkRequest(values, agreement) {
  const { channel, date } = values;
  const source = importedFile?.text === values.message ? importedFile : null;
  const message = source?.original ?? values.message;
  if (!message.trim() || message.length > LIMITS.request) throw new Error('Enter a client request of up to 8,000 characters.');
  if (!validDate(date)) throw new Error('Enter a valid message date.');
  let assessment = localAssessment(message, agreement.clauses);
  if (values.ai === 'on') {
    try {
      const response = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message, consent: true,
          clauses: agreement.clauses.map(({ id, category, quote }) => ({ id, category, quote })),
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error('AI check unavailable');
      assessment = await response.json();
    } catch {
      assessment = {
        ...assessment, verdict: 'unclear', method: 'fallback',
        reason: 'The AI check could not be completed. Review the agreement and record your decision.',
      };
    }
  }
  return makeRequest({ message, channel, date, filename: source?.name ?? null }, agreement, assessment);
}

const forms = {
  async 'restore-form'(values) {
    const { backup } = values;
    if (!backup?.name || backup.size > BACKUP_LIMIT) throw new Error('Choose a ScopeCheck JSON backup of up to 16 MB.');
    const project = restoreProject(await readUtf8File(backup));
    await writeProject(project.id, () => project);
    projects = await listProjects();
    chooseProject(project.id, 'review');
    showNotice('Project restored as a separate copy.');
  },
  async 'project-form'(values) {
    const name = values.name.trim();
    if (!name) throw new Error('Enter a project name.');
    const project = { id: id(), name, client: values.client.trim(), createdAt: new Date().toISOString(), agreements: [], requests: [] };
    await writeProject(project.id, () => project);
    projects = await listProjects();
    dialog.close();
    chooseProject(project.id, 'agreement');
    showNotice('Project created.');
  },
  async 'agreement-source'(values, form, _, project) {
    const file = form.elements.file.files[0];
    const text = values.source.replace(/\r\n?/g, '\n');
    if (!file && !text.trim()) throw new Error('Upload a file or paste the agreement text.');
    if (file && text.trim()) throw new Error('Choose one source. Clear the pasted text or remove the file.');
    const source = file ? await readAgreement(file) : { name: 'Pasted agreement text', kind: 'text', pages: [text] };
    const size = source.pages.reduce((count, page) => count + page.length, 0);
    if (size > LIMITS.agreement || !source.pages.some(page => page.trim())) throw new Error('Use readable agreement text of up to 100,000 characters.');
    if (form.isConnected) {
      draft = { source, rows: suggestClauses(source.pages), base: latestAgreement(project)?.id };
      render();
      const review = document.querySelector('#clause-review');
      review.scrollIntoView({ block: 'start' });
      review.querySelector('textarea, button').focus({ preventScroll: true });
    }
  },
  async 'clause-form'(_, form, __, project) {
    const { source, base } = draft;
    const agreement = makeAgreement(source, readClauseRows().filter(row => row.keep));
    await saveProject(project.id, stored => {
      if (latestAgreement(stored)?.id !== base) throw new Error('The agreement changed in another tab. Reload before adding a new version.');
      return { ...stored, agreements: [...stored.agreements, agreement] };
    });
    if (form.isConnected) {
      draft = null;
      render(true);
    }
    showNotice('Reviewed agreement saved.');
  },
  async 'request-form'(values, form, _, project) {
    if (pendingImport) throw new Error('Wait for the message excerpt to finish loading.');
    const agreement = latestAgreement(project);
    if (!agreement) throw new Error('Review an agreement before checking a request.');
    const record = await checkRequest(values, agreement);
    await saveProject(project.id, stored => {
      if (latestAgreement(stored)?.id !== agreement.id) throw new Error('The agreement changed in another tab. Reload before checking this request.');
      return { ...stored, requests: [record, ...stored.requests] };
    });
    if (form.isConnected) navigate('record', record.id);
    showNotice('Request saved for review.');
  },
  async 'decision-form'(values, form, _, project, record, data) {
    await saveRecord(project.id, record.id, (current, stored) => {
      const agreement = stored.agreements.find(item => item.id === current.agreementId);
      const count = (record.decisionHistory?.length ?? 0) + Number(Boolean(record.decision));
      return reviewRequest(current, agreement, values.verdict, data.getAll('citation'), values.note, count);
    });
    if (form.isConnected) render(true);
    showNotice('Scope decision recorded.');
  },
  async 'change-form'(values, form, submitter, project, record) {
    const action = submitter?.value || 'draft';
    await saveChange(project, record, action, values);
    if (form.isConnected) render(true);
    showNotice(action === 'ready' ? 'Change request ready to share.' : 'Draft saved.');
  },
  async 'shared-form'(_, form, __, project, record) {
    await saveChange(project, record, 'shared');
    if (form.isConnected) render(true);
    showNotice('Share recorded. You can now log the client response.');
  },
  async 'response-form'(values, form, submitter, project, record) {
    await saveChange(project, record, submitter?.value, values);
    if (form.isConnected) render(true);
    showNotice('Client response recorded.');
  },
};

document.addEventListener('submit', async event => {
  const form = event.target;
  const run = forms[form.id];
  if (!run) return;
  event.preventDefault();
  if (form.dataset.busy) return;
  form.dataset.busy = 'true';
  const data = new FormData(form);
  const project = displayedProject;
  const controls = [...form.elements].filter(control => !control.disabled);
  const submitter = event.submitter;
  const label = submitter?.innerHTML;
  formError(form);
  controls.forEach(control => { control.disabled = true; });
  if (submitter) submitter.textContent = 'Working…';
  try {
    await run(Object.fromEntries(data), form, submitter, project, activeRecord(project), data);
  } catch (error) {
    if (form.isConnected) formError(form, error.message);
    else showNotice(error.message);
  } finally {
    if (submitter) submitter.innerHTML = label;
    controls.forEach(control => { control.disabled = false; });
    delete form.dataset.busy;
  }
});

async function start() {
  try {
    const config = document.documentElement.dataset.hosted
      ? { ai: false }
      : fetch('/api/config').then(response => response.json()).catch(() => ({ ai: false }));
    projects = await listProjects();
    ai = (await config).ai;
    if (!activeProject()) projectId = projects[0]?.id;
    render();
  } catch {
    main.textContent = 'ScopeCheck could not open browser storage. Enable site storage, then reload this page.';
  }
}

await start();
