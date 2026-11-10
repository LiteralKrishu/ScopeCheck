'use client';

import { ArrowLeft, Download } from 'lucide-react';
import { amountFromPrice, changeText, DEFAULT_CURRENCY, LIMITS, recordText, VERDICTS } from '../lib/domain.js';
import {
  AgreementFile, Badge, Citations, PageHeading, Panel, RequestFields, SourceText, WorkForm,
  clauseSource, dateLabel, download, fields, statuses,
} from './workspace-ui.jsx';

const methods = { ai: 'AI suggestion', rules: 'Explicit scope match', local: 'Agreement search', fallback: 'AI check unavailable', example: 'Example assessment' };
const currencyCodes = Intl.supportedValuesOf('currency');

function Decision({ record, agreement, save }) {
  const { decision, assessment } = record;
  const history = record.decisionHistory ?? [];
  return <>
    {decision && <Panel title="Recorded decision">
      <div className="result-line"><Badge state={decision.verdict} /><span className="hint">{dateLabel(decision.at)}</span></div>
      {decision.note && <p className="quoted-message">{decision.note}</p>}
      <Citations agreement={agreement} ids={decision.citationIds} />
      {history.length > 0 && <details className="source-text"><summary>Earlier decisions ({history.length})</summary>
        {history.map((item, index) => <section key={index}>
          <div className="result-line"><Badge state={item.verdict} /><span className="hint">{dateLabel(item.at)}</span></div>
          {item.note && <p className="quoted-message">{item.note}</p>}
          <Citations agreement={agreement} ids={item.citationIds} />
        </section>)}
      </details>}
    </Panel>}
    {(!decision || decision.verdict === 'unclear') && <Panel title={decision ? 'Record a follow-up' : 'Record your decision'}
      subtitle={decision ? 'Add a decision after you clarify the request.' : 'Choose the result and the clauses that support it.'}>
      <WorkForm onSave={data => save({
        kind: 'decision', recordId: record.id, verdict: data.get('verdict'),
        citationIds: data.getAll('citation'), note: data.get('note'),
      }, 'Scope decision recorded.')}>
        <label>Decision<select name="verdict" defaultValue={decision?.verdict ?? assessment.verdict}>
          {Object.entries(VERDICTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <fieldset className="select-evidence">
          <legend>Supporting clauses</legend>
          {agreement.clauses.map(clause => <label className="check" key={clause.id}>
            <input type="checkbox" name="citation" value={clause.id}
              defaultChecked={(decision?.citationIds ?? assessment.citationIds).includes(clause.id)} />
            <span><strong>{clause.id} / {clauseSource(agreement, clause)}</strong><br />{clause.quote}</span>
          </label>)}
        </fieldset>
        <label>Review note <span className="optional">Optional</span><textarea name="note" rows={3} maxLength={1000}
          placeholder="Add context or a question for the client…" /></label>
        <div className="actions"><button className="button primary" type="submit">Record decision</button></div>
      </WorkForm>
    </Panel>}
  </>;
}

function ChangeDraft({ change, record, update }) {
  const legacy = Boolean(change?.price) && change.currency === undefined;
  return <Panel title="Prepare a change request" subtitle="Set the time impact and price before marking the draft ready.">
    <WorkForm onSave={(data, action) => update({ ...fields(data), action: action || 'draft' },
      action === 'ready' ? 'Change request ready to share.' : 'Draft saved.')}>
      <label>Requested work<textarea name="work" rows={3} maxLength={LIMITS.request} defaultValue={change?.work ?? record.message} required /></label>
      <label>Time impact<input name="impact" defaultValue={change?.impact} maxLength={500} placeholder="2 extra business days" /></label>
      <div className="fields">
        <label>Currency code<input name="currency" defaultValue={legacy ? '' : change?.currency ?? DEFAULT_CURRENCY}
          list="currency-codes" maxLength={3} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-describedby="price-help" /></label>
        <label>{legacy ? 'Price' : 'Amount'}<input name="price" defaultValue={change ? amountFromPrice(change) : ''}
          inputMode={legacy ? 'text' : 'decimal'} maxLength={LIMITS.price} placeholder="1000.00" aria-describedby="price-help" /></label>
      </div>
      <datalist id="currency-codes">{currencyCodes.map(code => <option key={code} value={code} />)}</datalist>
      <p id="price-help" className="hint">{legacy
        ? 'Leave currency blank to keep the existing price as text. To set a currency code, enter the amount without a symbol.'
        : 'Use a three-letter currency code. Enter the amount without grouping separators.'}</p>
      <div className="actions">
        <button className="button secondary" type="submit" value="draft">Save draft</button>
        <button className="button primary" type="submit" value="ready">Mark ready to share</button>
      </div>
    </WorkForm>
  </Panel>;
}

function ChangeRequest({ project, record, save }) {
  if (record.decision?.verdict !== 'out') return null;
  const { change } = record;
  const update = (values, message) => save({ kind: 'change', recordId: record.id, values }, message);
  if (!change || change.status === 'draft') return <ChangeDraft change={change} record={record} update={update} />;
  const { response } = change;
  return <Panel title="Change request">
    <div><Badge state={change.status} /></div>
    <dl className="terms"><dt>Work</dt><dd>{change.work}</dd><dt>Time impact</dt><dd>{change.impact}</dd><dt>Price</dt><dd>{change.price}</dd></dl>
    <div className="actions">
      <button className="button secondary" type="button" onClick={() =>
        download(`scopecheck-change-${record.id.slice(0, 8)}.txt`, changeText(project, change))}>
        <Download size={16} /> Download draft
      </button>
    </div>
    {change.status === 'ready' && <WorkForm onSave={(_, action) => update({ action: action ?? 'shared' },
      action === 'reopen' ? 'Draft reopened.' : 'Share recorded.')}>
      <p className="hint">Send the reviewed draft to the client, then mark it as shared here.</p>
      <div className="actions">
        <button className="button primary" type="submit" value="shared">Mark as shared</button>
        <button className="button quiet" type="submit" value="reopen">Edit draft</button>
      </div>
    </WorkForm>}
    {change.status === 'shared' && <WorkForm onSave={(data, action) => update({ ...fields(data), action }, 'Client response recorded.')}>
      <RequestFields channel={record.channel} response />
      <label>Written client response<textarea name="response" rows={4} maxLength={LIMITS.request} required /></label>
      <div className="actions">
        <button className="button primary" type="submit" value="approved">Record approval</button>
        <button className="button secondary" type="submit" value="declined">Record decline</button>
      </div>
    </WorkForm>}
    {response && <div className="response-note">
      <h3>Client response</h3><p className="hint">{response.channel} / {dateLabel(response.date)}</p><blockquote>{response.text}</blockquote>
    </div>}
    <ol className="timeline">
      <li>Draft prepared <time dateTime={change.draftedAt}>{dateLabel(change.draftedAt)}</time></li>
      <li>Draft reviewed <time dateTime={change.readyAt}>{dateLabel(change.readyAt)}</time></li>
      {change.sharedAt && <li>Marked as shared <time dateTime={change.sharedAt}>{dateLabel(change.sharedAt)}</time></li>}
      {response && <li>{statuses[change.status]} <time dateTime={response.recordedAt}>{dateLabel(response.recordedAt)}</time></li>}
    </ol>
  </Panel>;
}

export function RecordScreen({ project, record, save, back }) {
  const { assessment } = record;
  const agreement = project.agreements.find(item => item.id === record.agreementId);
  return <>
    <button className="button quiet back-button" type="button" onClick={back}><ArrowLeft size={16} /> Change log</button>
    <PageHeading title="Review details" actions={<button className="button secondary" type="button" onClick={() =>
      download(`scopecheck-record-${record.id.slice(0, 8)}.txt`, recordText(project, record, agreement))}>
      <Download size={16} /> Export evidence
    </button>}>The original request, its scope evidence, and the decision.</PageHeading>
    <div className="desk-grid record-grid">
      <div className="stack">
        <Panel title="Original request" className="intake-panel">
          <p className="hint">{record.channel} / {dateLabel(record.date)}{record.filename && ` / ${record.filename}`}</p>
          <blockquote className="quoted-message">{record.message}</blockquote>
        </Panel>
        <Decision record={record} agreement={agreement} save={save} />
        <ChangeRequest project={project} record={record} save={save} />
      </div>
      <aside className="desk-aside"><Panel title="Scope assessment" className="reference-panel">
        <div className="result-line"><Badge state={assessment.verdict} /><span className="hint">{methods[assessment.method]}</span></div>
        <p>{assessment.reason}</p>
        <AgreementFile agreement={agreement} />
        <Citations agreement={agreement} ids={assessment.citationIds} />
        <SourceText agreement={agreement} />
      </Panel></aside>
    </div>
  </>;
}
