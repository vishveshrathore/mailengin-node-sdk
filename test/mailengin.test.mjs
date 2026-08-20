import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MailEngin, MailEnginError } from '../dist/index.js';

const jsonResponse = (body, init = {}) => new Response(
  JSON.stringify(body),
  {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  },
);

const createFetchMock = (implementation) => {
  const calls = [];
  const fetchMock = async (...args) => {
    calls.push(args);
    return implementation(...args);
  };
  fetchMock.calls = calls;
  return fetchMock;
};

describe('MailEngin', () => {
  it('sends a published template and maps camelCase fields', async () => {
    const fetchMock = createFetchMock(async () => jsonResponse({
      id: 'msg_123',
      from: 'hello@example.com',
      to: 'person@example.com',
      template_name: 'welcome-email',
      created_at: '2026-08-18T10:00:00.000Z',
    }));
    const mailengin = new MailEngin({ apiKey: 're_test_key', fetch: fetchMock });

    const result = await mailengin.emails.send({
      to: 'person@example.com',
      templateName: 'welcome-email',
      variables: { first_name: 'Asha' },
      fromEmail: 'hello@example.com',
      replyToMailEngin: true,
    });

    assert.equal(fetchMock.calls.length, 1);
    const [url, init] = fetchMock.calls[0];
    assert.equal(url, 'https://api.mailengin.app/api/developer/send');
    assert.match(init.headers.Authorization, /^Bearer re_test_key$/);
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(init.body), {
      to: 'person@example.com',
      template_name: 'welcome-email',
      variables: { first_name: 'Asha' },
      from_email: 'hello@example.com',
      reply_to_mailengin: true,
    });
    assert.deepEqual(result, {
      id: 'msg_123',
      from: 'hello@example.com',
      to: 'person@example.com',
      templateName: 'welcome-email',
      createdAt: '2026-08-18T10:00:00.000Z',
    });
  });

  it('sends bulk recipients with global and per-recipient variables', async () => {
    const fetchMock = createFetchMock(async () => jsonResponse({
      success: true,
      jobId: 'bulk_123',
      queued_count: 2,
      template_name: 'welcome-email',
      message: 'Queued',
    }));
    const mailengin = new MailEngin({ apiKey: 're_test_key', fetch: fetchMock });

    const result = await mailengin.emails.sendBulk({
      to: [
        { email: 'a@example.com', variables: { first_name: 'A' } },
        { email: 'b@example.com', variables: { first_name: 'B' } },
      ],
      templateName: 'welcome-email',
      variables: { company: 'MailEngin' },
    });

    const [, init] = fetchMock.calls[0];
    assert.deepEqual(JSON.parse(init.body), {
      to: [
        { email: 'a@example.com', variables: { first_name: 'A' } },
        { email: 'b@example.com', variables: { first_name: 'B' } },
      ],
      template_name: 'welcome-email',
      variables: { company: 'MailEngin' },
    });
    assert.deepEqual(result, {
      success: true,
      jobId: 'bulk_123',
      queuedCount: 2,
      templateName: 'welcome-email',
      message: 'Queued',
    });
  });

  it('supports advanced raw HTML sends', async () => {
    const fetchMock = createFetchMock(async () => jsonResponse({
      id: 'msg_html',
      from: 'hello@example.com',
      to: 'person@example.com',
      template_name: null,
      created_at: '2026-08-18T10:00:00.000Z',
    }));
    const mailengin = new MailEngin({ apiKey: 're_test_key', fetch: fetchMock });

    await mailengin.emails.send({
      to: 'person@example.com',
      subject: 'Hello',
      html: '<h1>Hello</h1>',
    });

    const [, init] = fetchMock.calls[0];
    assert.deepEqual(JSON.parse(init.body), {
      to: 'person@example.com',
      subject: 'Hello',
      html: '<h1>Hello</h1>',
    });
  });

  it('throws a structured error for API failures', async () => {
    const fetchMock = createFetchMock(async () => jsonResponse(
      { success: false, message: 'Invalid or revoked API key', code: 'invalid_api_key' },
      { status: 401, headers: { 'x-request-id': 'req_123' } },
    ));
    const mailengin = new MailEngin({ apiKey: 're_bad_key', fetch: fetchMock });

    await assert.rejects(
      mailengin.emails.send({
        to: 'person@example.com',
        templateName: 'welcome-email',
      }),
      (error) => {
        assert.ok(error instanceof MailEnginError);
        assert.equal(error.message, 'Invalid or revoked API key');
        assert.equal(error.status, 401);
        assert.equal(error.code, 'invalid_api_key');
        assert.equal(error.requestId, 'req_123');
        assert.equal(error.isRetryable, false);
        return true;
      },
    );
  });

  it('exposes rate-limit retry information', async () => {
    const fetchMock = createFetchMock(async () => jsonResponse(
      { success: false, message: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '12' } },
    ));
    const mailengin = new MailEngin({ apiKey: 're_test_key', fetch: fetchMock });

    await assert.rejects(
      mailengin.emails.send({ to: 'person@example.com', templateName: 'welcome-email' }),
      (error) => {
        assert.ok(error instanceof MailEnginError);
        assert.equal(error.status, 429);
        assert.equal(error.retryAfter, 12);
        assert.equal(error.isRetryable, true);
        return true;
      },
    );
  });

  it('validates configuration and content before making a request', async () => {
    assert.throws(() => new MailEngin(''), /non-empty apiKey/);

    const fetchMock = createFetchMock(async () => jsonResponse({}));
    const mailengin = new MailEngin({ apiKey: 're_test_key', fetch: fetchMock });
    await assert.rejects(
      mailengin.emails.send({
        to: 'person@example.com',
        html: '<p>Hello</p>',
      }),
      /Raw HTML sends require subject/,
    );
    assert.equal(fetchMock.calls.length, 0);
  });
});
