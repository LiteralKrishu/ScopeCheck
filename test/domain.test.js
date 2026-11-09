import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  changeText, localAssessment, makeAgreement, makeRequest, reviewRequest,
  suggestClauses, updateChange, verifyAssessment,
} from '../public/domain.js';

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
  const work = { work: 'Add payment checkout', impact: 'Two working days', price: '₹8,000' };
  const draft = updateChange(reviewed, 'draft', { ...work, price: '' });
  assert.throws(() => updateChange(draft, 'ready', { ...work, price: '' }), /price/);
  const ready = updateChange(draft, 'ready', work);
  assert.equal(updateChange(ready, 'reopen').change.status, 'draft');
  assert.match(changeText({ name: 'Website' }, ready.change), /₹8,000/);
  const evidence = { channel: 'WhatsApp', date: '2026-11-10', response: 'I approve the price and schedule.' };
  assert.throws(() => updateChange(ready, 'approved', evidence), /shared/);
  const shared = updateChange(ready, 'shared');
  assert.throws(() => updateChange(shared, 'approved', { ...evidence, response: '' }), /client response/);
  const approved = updateChange(shared, 'approved', evidence);
  assert.equal(approved.change.status, 'approved');
  assert.equal(approved.change.response.text, evidence.response);
  assert.throws(() => updateChange(approved, 'declined', evidence), /shared/);
});
