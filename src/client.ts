import { MailEnginError } from './errors.js';
import type { FetchLike, MailEnginApiErrorBody, MailEnginOptions, RequestOptions } from './types.js';

export const DEFAULT_BASE_URL = 'https://api.mailengin.app';
const DEFAULT_TIMEOUT_MS = 30_000;

interface RequestConfig extends RequestOptions {
  body: unknown;
}

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, '');

const readRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
};

const isApiErrorBody = (body: unknown): body is MailEnginApiErrorBody => (
  typeof body === 'object' && body !== null
);

const parseBody = (rawBody: string): unknown => {
  if (!rawBody) return null;

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
};

export class MailEnginClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetcher: FetchLike;

  constructor(options: MailEnginOptions) {
    if (!options.apiKey?.trim()) {
      throw new TypeError('MailEngin requires a non-empty apiKey.');
    }

    if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0)) {
      throw new TypeError('MailEngin timeoutMs must be a positive number.');
    }

    const fetcher = options.fetch ?? globalThis.fetch;
    if (typeof fetcher !== 'function') {
      throw new TypeError('MailEngin requires fetch support. Use Node.js 18 or newer.');
    }

    this.apiKey = options.apiKey.trim();
    this.baseUrl = normalizeBaseUrl(options.baseUrl?.trim() || DEFAULT_BASE_URL);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetcher = fetcher.bind(globalThis) as FetchLike;
  }

  async post<T>(path: string, config: RequestConfig): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    const abortFromCaller = () => controller.abort(config.signal?.reason);
    if (config.signal?.aborted) {
      abortFromCaller();
    } else {
      config.signal?.addEventListener('abort', abortFromCaller, { once: true });
    }

    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'mailengin-node/0.1.0',
        },
        body: JSON.stringify(config.body),
        signal: controller.signal,
      });

      const parsedBody = parseBody(await response.text());
      if (!response.ok) {
        const body = isApiErrorBody(parsedBody) || typeof parsedBody === 'string' ? parsedBody : null;
        const message = isApiErrorBody(parsedBody) && typeof parsedBody.message === 'string'
          ? parsedBody.message
          : `MailEngin API request failed with status ${response.status}.`;
        const code = isApiErrorBody(parsedBody) && typeof parsedBody.code === 'string'
          ? parsedBody.code
          : undefined;

        throw new MailEnginError(message, {
          status: response.status,
          code,
          requestId: response.headers.get('x-request-id') ?? undefined,
          retryAfter: readRetryAfter(response.headers.get('retry-after')),
          body,
        });
      }

      return parsedBody as T;
    } catch (error) {
      if (error instanceof MailEnginError) throw error;

      if (timedOut) {
        throw new MailEnginError(`MailEngin request timed out after ${this.timeoutMs}ms.`, {
          code: 'request_timeout',
          cause: error,
        });
      }

      if (config.signal?.aborted) {
        throw new MailEnginError('MailEngin request was aborted.', {
          code: 'request_aborted',
          cause: error,
        });
      }

      throw new MailEnginError('Unable to reach the MailEngin API.', {
        code: 'network_error',
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
      config.signal?.removeEventListener('abort', abortFromCaller);
    }
  }
}
