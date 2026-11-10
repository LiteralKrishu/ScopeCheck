'use client';

import { useRef, useState } from 'react';
import { ArrowRight, Download, FileCheck2, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { BACKUP_LIMIT, projectBackup } from '../lib/backup.js';
import { demoMessage, examples } from '../lib/demo.js';
import { CATEGORIES, LIMITS, VERDICTS, id, suggestClauses } from '../lib/domain.js';
import { readAgreement, readUtf8File } from '../lib/pdf.js';
import {
  AgreementFile, Citations, PageHeading, Panel, RequestFields, RequestList, SourceText, WorkForm,
  dateLabel, download, fields, statuses,
} from './workspace-ui.jsx';

export function EmptyWorkspace({ create, browse }) {
  return <section className="empty-workspace">
    <div className="empty-mark"><FolderOpen size={33} strokeWidth={1.45} /></div>
    <PageHeading title="Give your next project a scope record.">
      Start with a signed agreement, then log requests and decisions as they come in.
    </PageHeading>
    <div className="actions">
      <button className="button primary" type="button" onClick={create}><Plus size={17} /> New project</button>
      <button className="button secondary" type="button" onClick={browse}>Browse examples <ArrowRight size={16} /></button>
    </div>
    <ol className="workflow">
      <li><span>1</span><div><strong>File the agreement</strong><small>Keep the exact wording.</small></div></li>
      <li><span>2</span><div><strong>Check a request</strong><small>Find the clauses that apply.</small></div></li>
      <li><span>3</span><div><strong>Record the decision</strong><small>Keep any written approval.</small></div></li>
    </ol>
  </section>;
}

export function ReviewDesk({ project, agreement, ai, save, open, navigate }) {
  const message = useRef(null);
  const fileInput = useRef(null);
  const fileTask = useRef(null);
  const imported = useRef(null);
  const [fileError, setFileError] = useState('');
  const counts = agreement && CATEGORIES.map(category => [category, agreement.clauses.filter(clause => clause.category === category).length]);
  async function importMessage(event) {
    const input = event.currentTarget;
    const file = input.files[0];
    const original = message.current.value;
    imported.current = null;
    setFileError('');
    if (!file) return;
    const task = (async () => {
      if (!/\.txt$/i.test(file.name) || file.size > LIMITS.request * 4) throw new Error('Choose a UTF-8 TXT excerpt of up to 8,000 characters.');
      const text = await readUtf8File(file);
      if (!text.trim() || text.length > LIMITS.request || text.includes('\0')) throw new Error('Choose a plain-text excerpt of up to 8,000 characters.');
      return text;
    })();
    fileTask.current = task;
    try {
      const text = await task;
      if (fileTask.current !== task || input.files[0] !== file || !message.current || message.current.value !== original) return;
      message.current.value = text;
      imported.current = { name: file.name, text, fieldValue: message.current.value };
    } catch (error) {
      if (input.files[0] === file) {
        input.value = '';
        setFileError(error.message);
      }
    } finally {
      if (fileTask.current === task) fileTask.current = null;
    }
  }
  return <>
    <PageHeading title="Review desk">Compare the client’s request with the agreement on file.</PageHeading>
    <div className="desk-grid review-grid">
      <div className="stack">
        <Panel title="New request" subtitle="Keep the client’s wording and the date it arrived." className="intake-panel">
          <WorkForm onSave={async data => {
            if (fileTask.current) throw new Error('Wait for the message excerpt to finish loading.');
            const values = fields(data);
            const excerpt = imported.current?.fieldValue === values.message ? imported.current : null;
            const result = await save({
              kind: 'request', channel: values.channel, date: values.date, message: excerpt?.text ?? values.message,
              filename: excerpt?.name ?? null, ai: values.ai === 'on',
            }, 'Request saved for review.');
            open(result.recordId);
          }}>
            <RequestFields />
            <label>Client message<textarea name="message" ref={message} rows={5} maxLength={LIMITS.request}
              placeholder="Could you also add…" required /></label>
            <label className="file-field">Import message <span className="optional">TXT</span>
              <input type="file" ref={fileInput} accept=".txt,text/plain" onChange={importMessage} /></label>
            {fileError && <p role="alert" className="message error">{fileError}</p>}
            {ai && <label className="check"><input type="checkbox" name="ai" />
              <span>Use AI for this request. Send the message and reviewed clauses to OpenAI.</span></label>}
            <div className="actions">
              <button className="button primary" type="submit" disabled={!agreement}>Check request <ArrowRight size={17} /></button>
              {project.demo && <button type="button" className="button quiet" onClick={() => {
                message.current.value = examples[project.example]?.message ?? demoMessage;
                fileInput.current.value = '';
                imported.current = null;
                setFileError('');
                message.current.focus();
              }}>Use example message</button>}
            </div>
            <p className="hint">{agreement ? 'You confirm the decision after reviewing the evidence.' : 'Add and review an agreement to enable checks.'}</p>
          </WorkForm>
        </Panel>
        <Panel title="Recent requests"><RequestList records={project.requests.slice(0, 5)} open={open} empty="Checked requests will appear here." /></Panel>
      </div>
      <aside className="desk-aside">
        <Panel title="Agreement on file" className="reference-panel">
          {agreement ? <>
            <AgreementFile agreement={agreement} />
            <ul className="clause-counts">{counts.filter(([, count]) => count).map(([category, count]) =>
              <li key={category}><span>{category}</span><strong>{count}</strong></li>)}</ul>
          </> : <p className="empty-note">No reviewed agreement yet.</p>}
          <button className="button secondary" type="button" onClick={() => navigate('agreement')}>
            <FileCheck2 size={16} /> {agreement ? 'View agreement' : 'Add agreement'}
          </button>
        </Panel>
      </aside>
    </div>
  </>;
}

function ClauseRow({ row, source, number, remove }) {
  return <fieldset className="clause-row">
    <legend>Clause {number}</legend>
    <div className="actions spread">
      <label className="check"><input type="checkbox" name="keep" defaultChecked /> Keep clause</label>
      <button type="button" className="button quiet danger" onClick={remove}>Remove</button>
    </div>
    <div className="fields">
      <label>Source<select name="page" defaultValue={row.page}>
        {source.pages.map((_, i) => <option key={i} value={i}>{source.kind === 'pdf' ? `Page ${i + 1}` : 'Pasted or uploaded text'}</option>)}
      </select></label>
      <label>Category<select name="category" defaultValue={row.category}>
        {CATEGORIES.map(category => <option key={category}>{category}</option>)}
      </select></label>
    </div>
    <label>Exact quote<textarea name="quote" rows={3} maxLength={LIMITS.quote} defaultValue={row.quote} /></label>
  </fieldset>;
}

export function AgreementScreen({ project, agreement, save }) {
  const [draft, setDraft] = useState(null);
  const heading = useRef(null);
  return <>
    <PageHeading title="Agreement">Review the exact clauses to use as evidence for new requests.</PageHeading>
    <div className="desk-grid">
      <div className="stack">
        <Panel title={agreement ? 'Add a new version' : 'Add an agreement'} subtitle="Choose a PDF with selectable text or a UTF-8 TXT file. You can also paste the agreement.">
          <WorkForm onSave={async data => {
            const file = data.get('file');
            const text = data.get('source').replace(/\r\n?/g, '\n');
            if (!file.name && !text.trim()) throw new Error('Upload a file or paste the agreement text.');
            if (file.name && text.trim()) throw new Error('Choose one source. Clear the pasted text or remove the file.');
            const source = file.name ? await readAgreement(file) : { name: 'Pasted agreement text', kind: 'text', pages: [text] };
            if (source.pages.join('').length > LIMITS.agreement || !source.pages.some(page => page.trim())) {
              throw new Error('Use readable agreement text of up to 100,000 characters.');
            }
            setDraft({ source, rows: suggestClauses(source.pages).map(row => ({ ...row, id: id() })) });
            requestAnimationFrame(() => heading.current?.focus());
          }}>
            <label>Agreement file<input type="file" name="file" accept=".pdf,.txt,application/pdf,text/plain" /></label>
            <label>Agreement text<textarea name="source" rows={5} maxLength={LIMITS.agreement} placeholder="Paste the signed scope here…" /></label>
            <div className="actions"><button className="button primary" type="submit">Extract clauses <ArrowRight size={17} /></button></div>
          </WorkForm>
        </Panel>
        {draft && <Panel title={<span ref={heading} tabIndex={-1}>Review extracted clauses</span>}
          subtitle="Keep each quote exactly as it appears on the source page.">
          <WorkForm onSave={async (_, __, form) => {
            const rows = [...form.querySelectorAll('.clause-row')].filter(row => row.querySelector('[name="keep"]').checked).map(row => ({
              page: Number(row.querySelector('[name="page"]').value),
              category: row.querySelector('[name="category"]').value,
              quote: row.querySelector('[name="quote"]').value,
            }));
            if (!rows.length) throw new Error('Keep at least one clause.');
            await save({ kind: 'agreement', source: draft.source, rows }, 'Reviewed agreement saved.');
            setDraft(null);
          }}>
            <SourceText agreement={draft.source} />
            {draft.rows.map((row, index) => <ClauseRow key={row.id} row={row} source={draft.source} number={index + 1}
              remove={() => setDraft({ ...draft, rows: draft.rows.filter(item => item.id !== row.id) })} />)}
            <div className="actions">
              <button className="button secondary" type="button" disabled={draft.rows.length >= LIMITS.clauses}
                onClick={() => setDraft({ ...draft, rows: [...draft.rows, { id: id(), page: 0, category: 'Other', quote: '' }] })}>
                <Plus size={16} /> Add clause
              </button>
              <button className="button primary" type="submit">Save reviewed agreement</button>
            </div>
          </WorkForm>
        </Panel>}
      </div>
      <aside className="desk-aside"><Panel title="Current version" className="reference-panel">
        {agreement ? <>
          <AgreementFile agreement={agreement} />
          <p className="hint">Version {project.agreements.length}</p>
          <Citations agreement={agreement} ids={agreement.clauses.map(clause => clause.id)} />
          <SourceText agreement={agreement} />
        </> : <p className="empty-note">Saved clauses will appear here.</p>}
      </Panel></aside>
    </div>
  </>;
}

export function LogScreen({ project, open }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const requests = project.requests;
  const phrase = query.trim().toLowerCase();
  const filtered = requests.filter(record => {
    const state = record.change?.status ?? record.decision?.verdict ?? 'review';
    return (!status || status === state) && (!phrase || [record.message, record.channel, record.filename, record.date,
      record.decision?.note, record.change?.work, record.change?.response?.text].some(value => value?.toLowerCase().includes(phrase)));
  });
  return <>
    <PageHeading title="Change log">Find the original request, review decision, and written response.</PageHeading>
    <Panel title="Request history">
      <div className="log-counts">
        <div><strong>{requests.filter(record => !record.decision || record.decision.verdict === 'unclear').length}</strong> Need review</div>
        <div><strong>{requests.filter(record => record.change?.status === 'shared').length}</strong> Awaiting response</div>
        <div><strong>{requests.filter(record => record.change?.status === 'approved').length}</strong> Approved</div>
      </div>
      <div className="fields log-filters">
        <label>Search requests<input type="search" value={query} maxLength={100} placeholder="Message, channel, or approval"
          onChange={event => setQuery(event.target.value)} /></label>
        <label>Status<select value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">All statuses</option><option value="review">Needs review</option>
          {Object.entries({ ...VERDICTS, ...statuses }).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
        </select></label>
      </div>
      <p className="hint" role="status">{filtered.length} of {requests.length} requests</p>
      <RequestList records={filtered} open={open} empty={requests.length ? 'No requests match this search.' : 'Checked requests will appear here.'} />
    </Panel>
  </>;
}

export function DataScreen({ project, add, restore, remove, notify }) {
  const [exampleError, setExampleError] = useState('');
  const [working, setWorking] = useState(false);
  return <>
    <PageHeading title="Data and examples">Try a fictional workflow, export a backup, or bring in a project from the old app.</PageHeading>
    <div className="stack">
      <Panel title="Try a workflow" subtitle="Each example starts with a reviewed agreement and a sample request.">
        <div className="example-list">{Object.entries(examples).map(([key, example]) => <article key={key}>
          <div><h3>{example.title}</h3><p>{example.description}</p></div>
          <button className="button secondary" type="button" disabled={working} onClick={async () => {
            setWorking(true);
            setExampleError('');
            try { await add({ kind: 'example', example: key }); }
            catch (error) { setExampleError(error.message); }
            finally { setWorking(false); }
          }}>Open example <ArrowRight size={16} /></button>
        </article>)}</div>
        {exampleError && <p className="message error" role="alert">{exampleError}</p>}
      </Panel>
      <div className="desk-grid balanced">
        <Panel title="Back up a project">
          {project ? <>
            <p>Download the agreements, requests, and decisions for <strong>{project.name}</strong>.</p>
            <p className="hint">The file contains readable project data. Store it somewhere private.</p>
            <button className="button secondary" type="button" onClick={() => {
              try {
                download(`scopecheck-project-${project.id}.json`, projectBackup(project), 'application/json');
                notify('Project backup downloaded.');
              } catch (error) { notify(error.message); }
            }}><Download size={16} /> Download backup</button>
          </> : <p className="empty-note">Select a project to download a backup.</p>}
        </Panel>
        <Panel title="Restore a project" subtitle="Restore creates a separate project in your account.">
          <WorkForm onSave={async data => {
            const file = data.get('backup');
            if (!file.name || file.size > BACKUP_LIMIT) throw new Error('Choose a ScopeCheck backup of up to 16 MB.');
            await restore(await readUtf8File(file));
          }}>
            <label>ScopeCheck backup<input type="file" name="backup" accept=".json,application/json" required /></label>
            <div className="actions"><button className="button primary" type="submit">Restore backup</button></div>
          </WorkForm>
        </Panel>
      </div>
      {project && <Panel title="Delete this project" subtitle={`Permanently remove ${project.name} and its records from your account.`}>
        <button className="button secondary danger" type="button" onClick={remove}><Trash2 size={16} /> Delete project</button>
      </Panel>}
    </div>
  </>;
}
