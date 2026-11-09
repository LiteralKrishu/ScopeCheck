import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectBackup, restoreProject } from '../public/backup.js';
import { createExample, demoProject } from '../public/demo.js';
import { localAssessment, recordText, reviewRequest, updateChange } from '../public/domain.js';

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
    work: 'Add online payments', impact: 'One day', price: '₹5,000',
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
});

test('restore rejects fabricated quotes, dangling references, and unsupported versions', () => {
  const project = demoProject();
  const modify = mutation => {
    const copy = JSON.parse(projectBackup(project));
    mutation(copy);
    assert.throws(() => restoreProject(JSON.stringify(copy)), /invalid agreement evidence/);
  };
  modify(copy => { copy.project.agreements[0].clauses[0].quote = 'Fabricated clause'; });
  modify(copy => { copy.project.requests[0].agreementId = 'missing'; });
  modify(copy => { copy.project.requests[0].decision.citationIds = ['C42']; });
  modify(copy => { copy.version = 2; });
  assert.throws(() => restoreProject('{'), /valid ScopeCheck JSON/);
});
