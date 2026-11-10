import { id, makeAgreement, makeRequest, reviewRequest } from './domain.js';

export const demoMessage = 'Could you add online payments?';
const quotes = [
  'Build a five-page brochure website for Harbor Studio with a contact form.',
  'Online payments, a storefront, and gift card sales are excluded from this project.',
  'The fixed fee includes two rounds of design revisions.',
  'Deliver the website by 30 November 2026 after receipt of the final copy.',
];

export function demoProject() {
  const agreement = makeAgreement({
    name: 'Harbor Studio — signed scope.txt', kind: 'text',
    pages: [quotes.join('\n\n')],
  }, quotes.map((quote, index) => ({
    page: 0, quote, category: ['Deliverable', 'Exclusion', 'Revision limit', 'Timeline'][index],
  })));
  const demo = makeRequest({
    message: 'Can we add online payments for gift cards?', channel: 'Email', date: '2026-11-08', filename: null,
  }, agreement, {
    verdict: 'out', citationIds: ['C02'], method: 'example',
    reason: 'The requested payment and gift card features are expressly excluded.',
  });
  const reviewed = reviewRequest(demo, agreement, 'out', ['C02'], 'Confirm gift card sales as a separate change.');
  return {
    id: 'harbor-studio', name: 'Harbor Studio website', client: 'Harbor Studio',
    demo: true, createdAt: new Date().toISOString(),
    agreements: [agreement], requests: [reviewed],
  };
}

export const examples = {
  web: {
    title: 'Fixed-price websites',
    description: 'Compare a feature request with the agreed website scope.',
    name: 'Harbor Studio website',
    client: 'Harbor Studio',
    source: quotes.map((quote, index) => [quote, ['Deliverable', 'Exclusion', 'Revision limit', 'Timeline'][index]]),
    message: 'Could you add online payments?',
    decision: 'out',
    citation: 'C02',
  },
  studio: {
    title: 'Creative and agency work',
    description: 'Separate included design work from new deliverables and extra revisions.',
    name: 'Juniper brand identity',
    client: 'Juniper Books',
    source: [
      ['Included: a logo package and a brand guide.', 'Deliverable'],
      ['Excluded: packaging design and product photography.', 'Exclusion'],
      ['The studio will include two review rounds.', 'Revision limit'],
    ],
    message: 'Could you create a brand guide?',
    decision: 'in',
    citation: 'C01',
  },
  operations: {
    title: 'Internal change control',
    description: 'Check a stakeholder request against a rollout plan or operating agreement.',
    name: 'Northline onboarding rollout',
    client: 'Northline Operations',
    source: [
      ['Included: an onboarding checklist and manager training.', 'Deliverable'],
      ['Excluded: HR data migration.', 'Exclusion'],
      ['Rollout starts after the pilot group signs off.', 'Timeline'],
    ],
    message: 'Could we offer extra training next month?',
    decision: 'unclear',
    citation: 'C01',
  },
};

export function createExample(key) {
  const { name, client, source, message, decision, citation } = examples[key];
  const agreement = makeAgreement({
    name: 'Example agreement.txt', kind: 'text',
    pages: [source.map(([quote]) => quote).join('\n\n')],
  }, source.map(([quote, category]) => ({ page: 0, quote, category })));
  const request = makeRequest({ message, channel: 'Email', date: '2026-11-09', filename: null }, agreement, {
    verdict: decision, citationIds: [citation], method: 'example',
    reason: decision === 'unclear'
      ? 'The agreement lists manager training. It does not specify whether the request is for that training or another session.'
      : 'Compare the named item in the request with the cited agreement text.',
  });
  return {
    id: id(), name, client, demo: true, example: key, createdAt: new Date().toISOString(),
    agreements: [agreement], requests: [request],
  };
}
