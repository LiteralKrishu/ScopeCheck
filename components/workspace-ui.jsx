'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, FileText } from 'lucide-react';
import { CHANNELS, VERDICTS } from '../lib/domain.js';

export const statuses = { draft: 'Draft', ready: 'Ready to share', shared: 'Awaiting response', approved: 'Approved', declined: 'Declined' };
export const dateLabel = value => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
export const fields = data => Object.fromEntries(data);

export function download(name, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function WorkForm({ children, onSave, className = '' }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  return <form className={className} onSubmit={async event => {
    event.preventDefault();
    if (working) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const action = event.nativeEvent.submitter?.value;
    setWorking(true);
    setError('');
    try { await onSave(data, action, form); }
    catch (error) { setError(error.message); }
    finally { setWorking(false); }
  }}>
    <fieldset className="form-stack form-controls" disabled={working} aria-busy={working}>
      {children}
    </fieldset>
    {working && <p className="hint form-feedback" role="status">Working…</p>}
    {error && <p className="message error form-feedback" role="alert">{error}</p>}
  </form>;
}

export function PageHeading({ title, children, actions }) {
  return <header className="page-heading"><div><h1>{title}</h1>{children && <p>{children}</p>}</div>{actions}</header>;
}

export function Panel({ title, subtitle, children, className = '' }) {
  return <section className={`panel ${className}`}>
    <header className="panel-head"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</header>
    {children}
  </section>;
}

export function Badge({ state, children }) {
  return <span className={`badge ${state ?? ''}`}>{children ?? statuses[state] ?? VERDICTS[state]}</span>;
}

export function RequestFields({ channel = 'Email', response = false }) {
  const [date, setDate] = useState('');
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setDate(current => current || now.toISOString().slice(0, 10));
  }, []);
  return <div className="fields">
    <label>{response ? 'Response channel' : 'Channel'}<select name="channel" defaultValue={channel}>
      {CHANNELS.map(item => <option key={item}>{item}</option>)}
    </select></label>
    <label>{response ? 'Response date' : 'Message date'}<input name="date" type="date" value={date}
      onChange={event => setDate(event.target.value)} required /></label>
  </div>;
}

export function AgreementFile({ agreement }) {
  const count = agreement.clauses.length;
  return <div className="agreement-file"><div className="file-icon"><FileText size={19} /></div><div>
    <strong>{agreement.name}</strong><span>{count} reviewed {count === 1 ? 'clause' : 'clauses'} / {dateLabel(agreement.reviewedAt)}</span>
  </div></div>;
}

export const clauseSource = (agreement, clause) => agreement.kind === 'pdf' ? `Page ${clause.page + 1}` : 'Text source';

export function Citations({ agreement, ids }) {
  const clauses = ids.map(id => agreement.clauses.find(clause => clause.id === id)).filter(Boolean);
  if (!clauses.length) return <p className="hint">No supporting clauses selected.</p>;
  return <div className="citations">{clauses.map(clause => <div className="citation" key={clause.id}>
    <div className="citation-label"><b>{clause.id}</b><span>{clause.category}</span><span>{clauseSource(agreement, clause)}</span></div>
    <blockquote>{clause.quote}</blockquote>
  </div>)}</div>;
}

export function SourceText({ agreement }) {
  return <details className="source-text"><summary>View source text</summary>
    {agreement.pages.map((page, index) => <section key={index}>
      <p className="hint">{agreement.kind === 'pdf' ? `Page ${index + 1}` : 'Text source'}</p><pre>{page}</pre>
    </section>)}
  </details>;
}

export function RequestList({ records, open, empty }) {
  if (!records.length) return <p className="empty-note">{empty}</p>;
  return <ul className="request-list">{records.map(record => {
    const state = record.change?.status ?? record.decision?.verdict ?? 'review';
    return <li key={record.id}><button type="button" onClick={() => open(record.id)}>
      <span className="request-title"><strong>{record.message.trim().replace(/\s+/g, ' ')}</strong>
        <span>{record.channel} / {dateLabel(record.date)}</span></span>
      <Badge state={state}>{state === 'review' ? 'Needs review' : undefined}</Badge><ArrowRight size={17} />
    </button></li>;
  })}</ul>;
}
