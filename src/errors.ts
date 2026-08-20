import type { MailEnginApiErrorBody } from './types.js';

export interface MailEnginErrorOptions {
  status?: number | undefined;
  code?: string | undefined;
  requestId?: string | undefined;
  retryAfter?: number | undefined;
  body?: MailEnginApiErrorBody | string | null | undefined;
  cause?: unknown | undefined;
}

export class MailEnginError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly retryAfter: number | undefined;
  readonly body: MailEnginApiErrorBody | string | null | undefined;

  constructor(message: string, options: MailEnginErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'MailEnginError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.retryAfter = options.retryAfter;
    this.body = options.body;
  }

  get isRetryable(): boolean {
    if (this.code === 'network_error' || this.code === 'request_timeout') {
      return true;
    }

    return this.status === 408 || this.status === 429 || (this.status !== undefined && this.status >= 500);
  }
}
