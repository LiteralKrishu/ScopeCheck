import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { assess } from '../server/assessment.js';
import { makeServer } from '../server/index.js';

const input = {
  message: 'Can you add online payments?',
  clauses: [{ id: 'C01', category: 'Exclusion', quote: 'Online payments are excluded.' }],
};

function providerResult(output) {
  return new Response(JSON.stringify({
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }],
  }));
}

test('AI checks request structured output with storage disabled', async () => {
  let call;
  const result = await assess(input, {
    key: 'test-key', model: 'test-model',
    fetcher: async (url, options) => {
      call = { url, body: JSON.parse(options.body) };
      return providerResult({ verdict: 'out', reason: 'The agreement excludes the requested feature.', citationIds: ['C01'] });
    },
  });
  assert.equal(result.verdict, 'out');
  assert.equal(result.method, 'ai');
  assert.equal(call.url, 'https://api.openai.com/v1/responses');
  assert.equal(call.body.store, false);
  assert.equal(call.body.text.format.strict, true);
  assert.deepEqual(JSON.parse(call.body.input), input);
});

test('invalid, refused, and failed provider responses remain unclear', async () => {
  const fetchers = [
    async () => providerResult({ verdict: 'out', reason: 'Excluded.', citationIds: ['C99'] }),
    async () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] })),
    async () => { throw new Error('Provider down'); },
  ];
  for (const fetcher of fetchers) {
    const result = await assess(input, { key: 'test-key', model: 'test-model', fetcher });
    assert.equal(result.verdict, 'unclear');
    assert.equal(result.method, 'fallback');
    assert.deepEqual(result.citationIds, ['C01']);
  }
});

test('the assessment endpoint returns 400 for non-string clause IDs', async () => {
  let providerCalls = 0;
  const server = makeServer({
    key: 'test-key',
    fetcher: async () => {
      providerCalls++;
      return new Response('', { status: 502 });
    },
  });
  const [handleRequest] = server.listeners('request');
  for (const id of [{ toString: null }, ['C01']]) {
    const body = { ...input, consent: true, clauses: [{ ...input.clauses[0], id }] };
    const request = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
      method: 'POST',
      url: '/api/assess',
      headers: {
        host: '127.0.0.1:3000',
        origin: 'http://127.0.0.1:3000',
        'content-type': 'application/json',
      },
    });
    const response = {
      setHeader() {},
      writeHead(status) { this.status = status; },
      end() {},
    };
    await handleRequest(request, response);
    assert.equal(response.status, 400);
  }
  assert.equal(providerCalls, 0);
});
