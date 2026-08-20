import { MailEnginClient } from './client.js';
import { Emails } from './resources/emails.js';
import type { MailEnginOptions } from './types.js';

export class MailEngin {
  readonly emails: Emails;

  constructor(apiKeyOrOptions: string | MailEnginOptions) {
    const options = typeof apiKeyOrOptions === 'string'
      ? { apiKey: apiKeyOrOptions }
      : apiKeyOrOptions;

    if (!options || typeof options !== 'object') {
      throw new TypeError('MailEngin requires an API key or options object.');
    }

    this.emails = new Emails(new MailEnginClient(options));
  }
}

export { DEFAULT_BASE_URL } from './client.js';
export { MailEnginError } from './errors.js';
export type {
  BulkRecipient,
  FetchLike,
  MailEnginApiErrorBody,
  MailEnginOptions,
  RequestOptions,
  SendBulkEmailParams,
  SendBulkEmailResponse,
  SendEmailParams,
  SendEmailResponse,
  Variables,
} from './types.js';
