import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LIMITS, amountFromPrice, changeText, localAssessment, makeAgreement, makeRequest, reviewRequest,
  suggestClauses, updateChange, verifyAssessment,
} from '../lib/domain.js';

const source = {
  name: 'Website scope.pdf', kind: 'pdf',
  pages: ['Deliverables:\nBuild a contact form.\nIncludes two rounds of design revisions.',
    '2. Exclusions\nOnline payments are excluded.'],
};

function agreement() {
  return makeAgreement(source, suggestClauses(source.pages));
}

function request(snapshot) {
  const message = 'Can we add online payments?\r\nPlease let me know.';
  return makeRequest({ message, channel: 'Email', date: '2026-11-09', filename: 'excerpt.txt' },
    snapshot, localAssessment(message, snapshot.clauses));
}

test('extracted clause quotes keep the source page and offset', () => {
  const snapshot = agreement();
  assert.equal(snapshot.clauses[0].category, 'Deliverable');
  assert.equal(snapshot.clauses[1].quote, 'Includes two rounds of design revisions.');
  const exclusion = snapshot.clauses[2];
  assert.equal(exclusion.category, 'Exclusion');
  assert.equal(exclusion.page, 1);
  assert.equal(snapshot.pages[1].slice(exclusion.start, exclusion.start + exclusion.quote.length), exclusion.quote);
  assert.throws(() => makeAgreement(source, [{ ...exclusion, quote: 'Payments included.' }]), /exactly/);
  assert.throws(() => makeAgreement(source, [{ ...exclusion, page: 0 }]), /exactly/);
});

test('local lookup keeps the request unclear and preserves the message', () => {
  const record = request(agreement());
  assert.equal(record.assessment.verdict, 'unclear');
  assert.equal(record.assessment.citationIds[0], 'C03');
  assert.match(record.message, /\r\n/);
  assert.equal(record.filename, 'excerpt.txt');
});

test('provisional verdicts require valid citations for decisive results', () => {
  const { clauses } = agreement();
  for (const verdict of ['in', 'out', 'unclear']) {
    assert.equal(verifyAssessment({ verdict, reason: 'Review the clause.', citationIds: ['C03'] }, clauses).verdict, verdict);
  }
  assert.equal(verifyAssessment({ verdict: 'out', reason: 'Excluded.', citationIds: [] }, clauses), null);
  assert.equal(verifyAssessment({ verdict: 'out', reason: 'Excluded.', citationIds: ['C03', 'C99'] }, clauses), null);
});

test('a human decision uses the agreement that was checked', () => {
  const snapshot = agreement();
  const record = request(snapshot);
  assert.throws(() => reviewRequest(record, agreement(), 'out', ['C03'], ''), /agreement version/);
  assert.throws(() => reviewRequest(record, snapshot, 'out', [], ''), /at least one clause/);
  const reviewed = reviewRequest(record, snapshot, 'out', ['C03'], 'Agreed scope excludes payments.');
  assert.equal(reviewed.assessment.verdict, 'unclear');
  assert.equal(reviewed.decision.verdict, 'out');
  assert.throws(() => reviewRequest(reviewed, snapshot, 'in', ['C01'], ''), /already/);
});

test('change terms need review and a written response before approval', () => {
  const snapshot = agreement();
  const record = request(snapshot);
  assert.throws(() => updateChange(record, 'draft', {}), /decision/);
  const reviewed = reviewRequest(record, snapshot, 'out', ['C03'], '');
  const work = { work: 'Add payment checkout', impact: 'Two working days', price: '8000' };
  const draft = updateChange(reviewed, 'draft', { ...work, price: '' });
  assert.throws(() => updateChange(draft, 'ready', { ...work, price: '' }), /price/);
  const ready = updateChange(draft, 'ready', work);
  assert.equal(updateChange(ready, 'reopen').change.status, 'draft');
  assert.match(changeText({ name: 'Website' }, ready.change), /INR 8000/);
  const evidence = { channel: 'WhatsApp', date: '2026-11-10', response: 'I approve the price and schedule.' };
  assert.throws(() => updateChange(ready, 'approved', evidence), /shared/);
  const shared = updateChange(ready, 'shared');
  assert.throws(() => updateChange(shared, 'approved', { ...evidence, response: '' }), /client response/);
  const approved = updateChange(shared, 'approved', evidence);
  assert.equal(approved.change.status, 'approved');
  assert.equal(approved.change.response.text, evidence.response);
  assert.throws(() => updateChange(approved, 'declined', evidence), /shared/);
});

test('change updates require the terms and status displayed in the current tab', () => {
  const snapshot = agreement();
  const reviewed = reviewRequest(request(snapshot), snapshot, 'out', ['C03'], '');
  const terms = { work: 'Add payment checkout', impact: 'Two working days', price: '100', currency: 'USD' };
  const ready = updateChange(reviewed, 'ready', terms);
  const reopened = updateChange(ready, 'reopen');
  const revised = updateChange(reopened, 'ready', { ...terms, price: '900' });
  const recoded = updateChange(reopened, 'ready', { ...terms, currency: 'EUR' });

  assert.throws(() => updateChange(revised, 'shared', {}, ready.change), /updated in another tab/);
  assert.throws(() => updateChange(revised, 'reopen', {}, ready.change), /updated in another tab/);
  assert.throws(() => updateChange(recoded, 'shared', {}, ready.change), /updated in another tab/);
  assert.equal(updateChange(revised, 'shared', {}, structuredClone(revised.change)).change.price, 'USD 900');

  const draft = updateChange(reviewed, 'draft', terms);
  const edited = updateChange(draft, 'draft', { ...terms, impact: 'Three working days' });
  assert.throws(() => updateChange(edited, 'ready', terms, draft.change), /updated in another tab/);
  assert.throws(() => updateChange(edited, 'draft', terms, null), /updated in another tab/);
});

test('prices default to INR and preserve exact amounts in any three-letter currency', () => {
  const snapshot = agreement();
  const reviewed = reviewRequest(request(snapshot), snapshot, 'out', ['C03'], '');
  const terms = { work: 'Add payment checkout', impact: 'Two working days' };
  const examples = [
    [undefined, '0.00', 'INR'],
    [' jpy ', '1200', 'JPY'],
    ['KWD', '1.025', 'KWD'],
    ['CLF', '2.3400', 'CLF'],
    ['XCG', '9007199254740993.01', 'XCG'],
    ['QAA', '7'.repeat(LIMITS.price - 4), 'QAA'],
  ];
  for (const [currency, price, expected] of examples) {
    const ready = updateChange(reviewed, 'ready', { ...terms, currency, price });
    assert.equal(ready.change.currency, expected);
    assert.equal(ready.change.price, `${expected} ${price}`);
    assert.equal(amountFromPrice(updateChange(ready, 'reopen').change), price);
  }

  const draft = updateChange(reviewed, 'draft', { ...terms, currency: 'USD', price: '' });
  assert.equal(draft.change.currency, 'USD');
  assert.equal(updateChange(draft, 'ready', { ...terms, price: '5' }).change.price, 'USD 5');
  for (const currency of ['', 'US', 'US1', 'USD extra']) {
    assert.throws(() => updateChange(reviewed, 'ready', { ...terms, currency, price: '5' }), /currency code/);
  }
  for (const price of ['1,000', '1e3', '-1', '₹10', 'NaN', '9'.repeat(LIMITS.price - 3)]) {
    assert.throws(() => updateChange(reviewed, 'ready', { ...terms, price }), /amount/);
  }
});

test('over-limit evidence is rejected and text at the limit is kept', () => {
  const snapshot = agreement();
  const message = 'a'.repeat(LIMITS.request - 1) + '!';
  const metadata = { channel: 'Email', date: '2026-11-09', filename: null };
  const assessment = localAssessment(message, snapshot.clauses);
  const record = makeRequest({ ...metadata, message }, snapshot, assessment);
  assert.equal(record.message, message);
  assert.throws(() => makeRequest({ ...metadata, message: message + '?' }, snapshot, assessment), /8,000/);

  const reviewed = reviewRequest(record, snapshot, 'out', ['C03'], '');
  const shared = updateChange(updateChange(reviewed, 'ready', {
    work: 'Add payment checkout', impact: 'Two working days', price: '100', currency: 'USD',
  }), 'shared');
  const response = { channel: metadata.channel, date: metadata.date, response: message };
  assert.equal(updateChange(shared, 'approved', response).change.response.text, message);
  assert.throws(() => updateChange(shared, 'approved', { ...response, response: message + '?' }), /8,000/);

  const quote = 'b'.repeat(LIMITS.quote);
  const text = quote.padEnd(LIMITS.agreement, 'c');
  const source = { name: 'Agreement.txt', kind: 'text', pages: [text] };
  const row = { quote, page: 0, category: 'Deliverable' };
  assert.equal(makeAgreement(source, [row]).pages[0], text);
  assert.throws(() => makeAgreement(source, [{ ...row, quote: quote + 'c' }]), /1,500/);
  assert.throws(() => makeAgreement({ ...source, pages: [text + 'd'] }, [row]), /size limit/);
});
