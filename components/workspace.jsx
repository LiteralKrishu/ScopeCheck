'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, ClipboardList, FileCheck2, FolderOpen, Library, Plus, RefreshCw, X } from 'lucide-react';
import { Install } from './install.jsx';
import { AgreementScreen, DataScreen, EmptyWorkspace, LogScreen, ReviewDesk } from './project-screens.jsx';
import { RecordScreen } from './record-screen.jsx';
import { WorkForm, fields } from './workspace-ui.jsx';

const screens = {
  review: { title: 'Review desk', Icon: ClipboardList },
  agreement: { title: 'Agreement', Icon: FileCheck2 },
  log: { title: 'Change log', Icon: Library },
  data: { title: 'Data and examples', Icon: FolderOpen },
};

async function projectApi(path, method = 'GET', body) {
  let response;
  try {
    response = await fetch(`/api/projects${path}`, {
      method, cache: 'no-store',
      ...(body !== undefined ? {
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      } : {}),
    });
  } catch {
    throw new Error('Check your connection. Reload the project if a save was in progress.');
  }
  if (response.status === 401) {
    window.location.assign('/sign-in');
    throw new Error('Sign in again to open your workspace.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The workspace request failed. Try again.');
  return data;
}

export function Workspace({ projects: initialProjects, snapshot: initialSnapshot, ai, account }) {
  const [projects, setProjects] = useState(initialProjects);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [screen, setScreen] = useState('review');
  const [recordId, setRecordId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const main = useRef(null);
  const newDialog = useRef(null);
  const deleteDialog = useRef(null);
  const noticeTimer = useRef(null);
  const project = snapshot?.project;
  const agreement = project?.agreements.at(-1);
  const record = project?.requests.find(item => item.id === recordId);

  useEffect(() => {
    function restore(event) {
      if (event.persisted) window.location.reload();
    }
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('pageshow', restore);
      clearTimeout(noticeTimer.current);
    };
  }, []);

  function notify(message) {
    clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(''), 4800);
  }

  function navigate(view, id = null) {
    setScreen(view);
    setRecordId(id);
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function select(next) {
    setSnapshot(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('project', next.project.id);
    else url.searchParams.delete('project');
    window.history.replaceState(null, '', url);
  }

  async function run(work) {
    if (pending.current) throw new Error('Wait for the current operation to finish.');
    pending.current = true;
    setBusy(true);
    setError('');
    try { return await work(); }
    finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function switchProject(id) {
    try {
      await run(async () => {
        select(await projectApi(`/${id}`));
        navigate('review');
      });
    } catch (error) { setError(error.message); }
  }

  async function create(command, view, message) {
    await run(async () => {
      const next = await projectApi('', 'POST', command);
      const { id, name, createdAt } = next.project;
      setProjects(items => [{ id, name, createdAt }, ...items]);
      select(next);
      newDialog.current?.close();
      navigate(view);
      notify(message);
    });
  }

  async function save(command, message) {
    return run(async () => {
      const next = await projectApi(`/${project.id}`, 'PATCH', { ...command, revision: snapshot.revision });
      setSnapshot(next);
      notify(message);
      return next;
    });
  }

  async function remove() {
    await run(async () => {
      await projectApi(`/${project.id}`, 'DELETE', { revision: snapshot.revision });
      deleteDialog.current.close();
      setProjects(items => items.filter(item => item.id !== project.id));
      select(null);
      navigate('data');
      notify('Project deleted.');
    });
  }

  function showNew() {
    newDialog.current.querySelector('form').reset();
    newDialog.current.showModal();
  }

  function open(id) { navigate('record', id); }

  return <>
    <a href="#workspace-main" className="skip-link">Skip to workspace</a>
    <div className="workspace-shell">
      <aside className="sidebar">
        <div className="brand"><img src="/mark.svg" width="34" height="34" alt="" /><span>ScopeCheck</span></div>
        <div className="project-picker">
          <label htmlFor="project-picker">Active project</label>
          <div className="project-select">
            <select id="project-picker" value={project?.id ?? ''} disabled={busy}
              onChange={event => event.target.value && switchProject(event.target.value)}>
              <option value="" disabled>{projects.length ? 'Select a project' : 'No projects yet'}</option>
              {projects.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <button className="button project-plus" type="button" aria-label="New project" disabled={busy} onClick={showNew}><Plus size={19} /></button>
          </div>
        </div>
        <nav aria-label="Workspace">
          {Object.entries(screens).map(([key, { title, Icon }]) => <button key={key} className="nav-item" type="button"
            disabled={busy} aria-current={screen === key || (screen === 'record' && key === 'log') ? 'page' : undefined}
            onClick={() => navigate(key)}><Icon size={18} strokeWidth={1.7} />{title}</button>)}
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Private workspace</div>
      </aside>
      <div className="workspace-content">
        <header className="workspace-bar">
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{project?.name ?? 'Projects'}</strong>
            {project?.demo && <span className="sample-label">Example</span>}</div>
          <div className="workspace-tools"><Install />
            <button className="button icon-button" type="button" title="Reload workspace" aria-label="Reload workspace"
              disabled={busy} onClick={() => window.location.reload()}><RefreshCw size={17} /></button>
            {account}</div>
        </header>
        <main id="workspace-main" tabIndex={-1} ref={main} className="workspace-main">
          {error && <p className="message error" role="alert">{error}</p>}
          {screen === 'data' ? <DataScreen project={project} notify={notify}
            add={command => create(command, 'review', 'Example project added.')}
            restore={backup => create(backup, 'review', 'Project restored as a separate copy.')}
            remove={() => deleteDialog.current.showModal()} />
            : !project ? <EmptyWorkspace create={showNew} browse={() => navigate('data')} />
              : <div key={project.id}>
                {screen === 'agreement' ? <AgreementScreen project={project} agreement={agreement} save={save} />
                  : screen === 'log' || (screen === 'record' && !record) ? <LogScreen project={project} open={open} />
                    : screen === 'record' ? <RecordScreen key={snapshot.revision} project={project} record={record} save={save} back={() => navigate('log')} />
                      : <ReviewDesk project={project} agreement={agreement} ai={ai} save={save} open={open} navigate={navigate} />}
              </div>}
        </main>
      </div>
    </div>
    {notice && <div className="toast" role="status"><Check size={17} />{notice}
      <button className="button icon-button" aria-label="Dismiss message" onClick={() => setNotice('')} type="button"><X size={17} /></button>
    </div>}
    <dialog ref={newDialog} aria-labelledby="new-project-heading">
      <h2 id="new-project-heading">New project</h2>
      <p>Use the project name from the agreement.</p>
      <WorkForm onSave={data => create({ kind: 'new', ...fields(data) }, 'agreement', 'Project created.')}>
        <label>Project name<input name="name" maxLength={80} required placeholder="Website redesign" /></label>
        <label>Client <span className="optional">Optional</span><input name="client" maxLength={80} placeholder="Client or company name" /></label>
        <div className="actions">
          <button className="button secondary" type="button" onClick={() => newDialog.current.close()}>Cancel</button>
          <button className="button primary" type="submit">Create project <ArrowRight size={16} /></button>
        </div>
      </WorkForm>
    </dialog>
    <dialog ref={deleteDialog} aria-labelledby="delete-project-heading">
      <h2 id="delete-project-heading">Delete project?</h2>
      <p>This permanently deletes <strong>{project?.name}</strong> and its records from your account.</p>
      <WorkForm onSave={remove}>
        <div className="actions">
          <button className="button secondary" type="button" onClick={() => deleteDialog.current.close()}>Cancel</button>
          <button className="button destructive" type="submit">Delete project</button>
        </div>
      </WorkForm>
    </dialog>
  </>;
}
