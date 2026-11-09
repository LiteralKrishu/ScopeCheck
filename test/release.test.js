import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectBackup, restoreProject } from '../public/backup.js';
import { createExample, demoProject } from '../public/demo.js';
import { localAssessment, recordText, reviewRequest, updateChange } from '../public/domain.js';
import { readAgreement, readUtf8File } from '../public/pdf.js';

test('local suggestions require an explicit match and defer mixed or conflicting requests', () => {
  const web = createExample('web');
  const studio = createExample('studio');
  const clauses = web.agreements[0].clauses;
  assert.equal(localAssessment(web.requests[0].message, clauses).verdict, 'out');
  assert.deepEqual(localAssessment(web.requests[0].message, clauses).citationIds, ['C02']);
  assert.equal(localAssessment(studio.requests[0].message, studio.agreements[0].clauses).verdict, 'in');
  assert.equal(localAssessment('Could you add online payments and a newsletter?', clauses).verdict, 'unclear');
  assert.equal(localAssessment(web.requests[0].message, [...clauses, {
    id: 'C05', category: 'Deliverable', quote: 'Included: online payments.',
  }]).verdict, 'unclear');
  assert.equal(localAssessment('Please add online payments.', [{
    id: 'C01', category: 'Deliverable', quote: 'Included: online payments, only after additional approval.',
  }]).verdict, 'unclear');
});

test('conditions and limits defer a verdict and retain the reviewed evidence', () => {
  const cases = [
    ['Exclusion', 'Excluded: product photography, provided the client supplies no samples.'],
    ['Deliverable', 'Included: product photography, limited to five products.'],
    ['Deliverable', 'Included: product photography, up to five products.'],
    ['Deliverable', 'Included: product photography, limited  to five products.'],
    ['Deliverable', 'Included: product photography, for the first five products.'],
    ['Deliverable', 'Included: product photography, first five products.'],
    ['Deliverable', 'Included: product photography, first 5 products.'],
    ['Exclusion', 'Excluded: product photography, above the first 500 items.'],
    ['Deliverable', 'Included: product photography and translation for the first five products.'],
    ['Exclusion', 'Excluded: product photography, outside the launch package.'],
    ['Exclusion', 'Excluded: product photography, outside launch packages.'],
  ];
  for (const [category, quote] of cases) {
    const result = localAssessment('Could you add product photography?', [{ id: 'C01', category, quote }]);
    assert.equal(result.verdict, 'unclear', quote);
    assert.deepEqual(result.citationIds, ['C01']);
  }

  const scope = { id: 'C01', category: 'Deliverable', quote: 'Included: online payments.', page: 0, start: 0 };
  for (const quote of ['This feature is optional and requires a separate fee.', 'For the first five orders.', 'Outside the launch package.']) {
    const condition = { id: 'C02', category: 'Other', quote, page: 0, start: 27 };
    const result = localAssessment('Could you add online payments?', [condition, scope]);
    assert.equal(result.verdict, 'unclear', quote);
    assert.deepEqual(result.citationIds, ['C01', 'C02']);
  }
  assert.equal(localAssessment('Could you add first aid training?', [{
    id: 'C01', category: 'Deliverable', quote: 'Included: 3D illustrations and first aid training.',
  }]).verdict, 'in');
});

test('text uploads reject invalid UTF-8 and retain valid Unicode', async () => {
  const text = 'Included: support for Café North.\r\nLiteral replacement character: \uFFFD';
  const valid = new File([text], 'valid.txt');
  assert.equal(await readUtf8File(valid), text);
  assert.deepEqual((await readAgreement(valid)).pages, [text.replace('\r\n', '\n')]);

  for (const bytes of [Buffer.from('Café North', 'latin1'), Uint8Array.of(0xe2, 0x82)]) {
    const invalid = new File([bytes], 'invalid.txt');
    await assert.rejects(readUtf8File(invalid), /Invalid UTF-8/);
    await assert.rejects(readAgreement(invalid), /Invalid UTF-8/);
  }
});

test('an unclear decision can be resolved with a retained, concurrency-checked history', () => {
  const project = createExample('operations');
  const [agreement] = project.agreements;
  const initial = reviewRequest(project.requests[0], agreement, 'unclear', ['C01'], 'Confirm the audience.');
  assert.throws(() => reviewRequest(initial, agreement, 'in', ['C01'], 'Confirmed.'), /newer or final/);
  const record = reviewRequest(initial, agreement, 'in', ['C01'], 'Confirmed this is manager training.', 1);
  assert.deepEqual(record.decisionHistory, [initial.decision]);
  const evidence = recordText(project, record, agreement);
  assert.match(evidence, /Confirm the audience\.[\s\S]*Confirmed this is manager training\./);
  assert.match(evidence, /Included: an onboarding checklist and manager training\./);
  assert.match(evidence, /Version: /);
});

test('backup round trip preserves source, revisions, and written approval under a new project ID', () => {
  const project = demoProject();
  const ready = updateChange(project.requests[0], 'ready', {
    work: 'Add online payments', impact: 'One day', price: '5000.00',
  });
  const shared = updateChange(ready, 'shared');
  project.requests[0] = updateChange(shared, 'approved', {
    response: 'Approved the change.', date: '2026-11-09', channel: 'Email',
  });
  const restored = restoreProject(projectBackup(project));
  assert.notEqual(restored.id, project.id);
  assert.equal(restored.demo, false);
  assert.deepEqual(restored.agreements, project.agreements);
  assert.deepEqual(restored.requests, project.requests);
  assert.match(recordText(restored, restored.requests[0], restored.agreements[0]), /Approved the change\./);
  assert.match(recordText(restored, restored.requests[0], restored.agreements[0]), /INR 5000\.00/);
  const invalid = JSON.parse(projectBackup(project));
  invalid.project.requests[0].change.currency = 'USD';
  assert.throws(() => restoreProject(JSON.stringify(invalid)), /invalid agreement evidence/);
});

test('restored older prices keep their original currency text unless a code is set explicitly', () => {
  const project = demoProject();
  const legacy = { work: 'Add online payments', impact: 'One day', price: '₹5,000 + GST' };
  project.requests[0].change = {
    ...legacy, status: 'ready', draftedAt: project.createdAt, readyAt: project.createdAt,
  };
  const restored = restoreProject(projectBackup(project));
  const [record] = restored.requests;
  const reopened = updateChange(record, 'reopen');
  const retained = updateChange(reopened, 'ready', { ...legacy, currency: '' });
  assert.equal(retained.change.price, legacy.price);
  assert.equal(retained.change.currency, undefined);
  const updated = updateChange(reopened, 'ready', { ...legacy, price: '5000.00', currency: 'INR' });
  assert.equal(updated.change.price, 'INR 5000.00');
  const unpriced = { ...reopened, change: { ...reopened.change, price: '' } };
  assert.equal(updateChange(unpriced, 'ready', { ...legacy, price: '5000.00' }).change.price, 'INR 5000.00');
});

test('restore rejects fabricated quotes, dangling references, and unsupported versions', () => {
  const project = demoProject();
  const modify = mutation => {
    const copy = JSON.parse(projectBackup(project));
    mutation(copy);
    assert.throws(() => restoreProject(JSON.stringify(copy)), /invalid agreement evidence/);
  };
  modify(copy => { copy.project.agreements[0].clauses[0].quote = 'Fabricated clause'; });
  modify(copy => { copy.project.agreements[0].clauses[0].id = ['C01']; });
  modify(copy => { copy.project.requests[0].agreementId = 'missing'; });
  modify(copy => { copy.project.requests[0].decision.citationIds = ['C42']; });
  modify(copy => { copy.version = 2; });
  assert.throws(() => restoreProject('{'), /valid ScopeCheck JSON/);
});
