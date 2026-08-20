import { describe, expect, it, vi } from 'vitest';
import { MailEngin, MailEnginError } from '../src/index.js';
import type { FetchLike } from '../src/index.js';

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response => new Response(
  JSON.stringify(body),
  {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  },
);

describe('MailEngin', () => {
  it('sends a published template and maps camelCase fields', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      id: 'msg_123',
      from: 'hello@example.com',
      to: 'person@example.com',
      template_name: 'welcome-email',
      created_at: '2026-08-18T10:00:00.000Z',
    }));
    const mailengin = new MailEngin({ apiKey: 're_test_key', fetch: fetchMock as FetchLike });

    const result = await mailengin.emails.send({
      to: 'person@example.com',
      templateName: 'welcome-email',
      variables: { first_name: 'Asha' },
      fromEmail: 'hello@example.com',
      replyToMailEngin: true,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.mailengin.app/api/developer/send');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer re_test_key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      to: 'person@example.com',
      template_name: 'welcome-email',
      variables: { first_name: 'Asha' },
      from_email: 'hello@example.com',
      reply_to_mailengin: true,
    });
    expect(result).toEqual({
      id: 'msg_123',
      from: 'hello@example.com',
      to: 'person@example.com',
      templateName: 'welcome-email',
      createdAt: '2026-08-18T10:00:00.000Z',
    });
  });

  it('sends bulk recipients with global and per-recipient variables', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      success: true,
      jobId: 'bulk_123',
      queued_count: 2,
      template_name: 'welcome-email',
      message: 'Queued',
    }));
    const mailengin = new MailEngin({ apiKey: 're_test_key', fetch: fetchMock as FetchLike });

    const result = await mailengin.emails.sendBulk({
      to: [
        { email: 'a@example.com', variables: { first_name: 'A' } },
        { email: 'b@example.com', variables: { first_name: 'B' } },
      ],
      templateName: 'welcome-email',
      variables: { company: 'MailEngin' },
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      to: [
        { email: 'a@example.com', variables: { first_name: 'A' } },
        { email: 'b@example.com', variables: { first_name: 'B' } },
      ],
      template_name: 'welcome-email',
      variables: { company: 'MailEngin' },
    });
    expect(result).toEqual({
      success: true,
      jobId: 'bulk_123',
      queuedCount: 2,
      templateName: 'welcome-email',
      message: 'Queued',
    });
  });

  it('supports advanced raw HTML sends', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      id: 'msg_html',
      from: 'hello@example.com',
      to: 'person@example.com',
      template_name: null,
      created_at: '2026-08-18T10:00:00.000Z',
    }));
    const mailengin = new MailEngin({ apiKey: 're_test_key', fetch: fetchMock as FetchLike });

    await mailengin.emails.send({
      to: 'person@example.com',
      subject: 'Hello',
      html: '<h1>Hello</h1>',
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      to: 'person@example.com',
      subject: 'Hello',
      html: '<h1>Hello</h1>',
    });
  });

  it('throws a structured error for API failures', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(
      { success: false, message: 'Invalid or revoked API key', code: 'invalid_api_key' },
      { status: 401, headers: { 'x-request-id': 'req_123' } },
    ));
    const mailengin = new MailEngin({ apiKey: 're_bad_key', fetch: fetchMock as FetchLike });

    await expect(mailengin.emails.send({
      to: 'person@example.com',
      templateName: 'welcome-email',
    })).rejects.toMatchObject({
      name: 'MailEnginError',
      message: 'Invalid or revoked API key',
      status: 401,
      code: 'invalid_api_key',
      requestId: 'req_123',
      isRetryable: false,
    });
  });

  it('exposes rate-limit retry information', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(
      { success: false, message: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': '12' } },
    ));
    const mailengin = new MailEngin({ apiKey: 're_test_key', fetch: fetchMock as FetchLike });

    try {
      await mailengin.emails.send({ to: 'person@example.com', templateName: 'welcome-email' });
      throw new Error('Expected the request to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(MailEnginError);
      expect(error).toMatchObject({ status: 429, retryAfter: 12, isRetryable: true });
    }
  });

  it('validates configuration and content before making a request', async () => {
    expect(() => new MailEngin('')).toThrow('non-empty apiKey');

    const fetchMock = vi.fn();
    const mailengin = new MailEngin({ apiKey: 're_test_key', fetch: fetchMock as FetchLike });
    await expect(mailengin.emails.send({
      to: 'person@example.com',
      html: '<p>Hello</p>',
    })).rejects.toThrow('Raw HTML sends require subject');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
