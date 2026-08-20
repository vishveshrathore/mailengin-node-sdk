import { MailEnginClient } from '../client.js';
import type {
  BulkRecipient,
  RequestOptions,
  SendBulkEmailParams,
  SendBulkEmailResponse,
  SendEmailParams,
  SendEmailResponse,
  Variables,
} from '../types.js';

interface SendEmailApiResponse {
  id: string;
  from: string;
  to: string;
  template_name: string | null;
  created_at: string;
}

interface SendBulkEmailApiResponse {
  success: true;
  jobId: string;
  queued_count: number;
  sent_count?: number;
  failed_count?: number;
  template_name: string | null;
  message: string;
}

type ApiBulkRecipient = string | { email: string; variables?: Variables };

const requireObject = (value: unknown, method: string): void => {
  if (!value || typeof value !== 'object') {
    throw new TypeError(`mailengin.emails.${method} requires a parameter object.`);
  }
};

const requireContentSource = (params: {
  templateName?: string;
  templateId?: string;
  html?: string;
  subject?: string;
}): void => {
  const hasTemplate = Boolean(params.templateName?.trim() || params.templateId?.trim());
  const hasRawHtml = Boolean(params.html?.trim());

  if (!hasTemplate && !hasRawHtml) {
    throw new TypeError('Provide templateName (recommended), templateId, or html.');
  }

  if (!hasTemplate && !params.subject?.trim()) {
    throw new TypeError('Raw HTML sends require subject.');
  }
};

const toBulkRecipient = (recipient: string | BulkRecipient): ApiBulkRecipient => {
  if (typeof recipient === 'string') return recipient;
  return {
    email: recipient.email,
    ...(recipient.variables === undefined ? {} : { variables: recipient.variables }),
  };
};

export class Emails {
  constructor(private readonly client: MailEnginClient) {}

  async send(params: SendEmailParams, options: RequestOptions = {}): Promise<SendEmailResponse> {
    requireObject(params, 'send');

    if (!params.to?.trim()) {
      throw new TypeError('mailengin.emails.send requires to.');
    }
    requireContentSource(params);

    const response = await this.client.post<SendEmailApiResponse>('/api/developer/send', {
      body: {
        to: params.to,
        ...(params.templateName === undefined ? {} : { template_name: params.templateName }),
        ...(params.templateId === undefined ? {} : { template_id: params.templateId }),
        ...(params.variables === undefined ? {} : { variables: params.variables }),
        ...(params.subject === undefined ? {} : { subject: params.subject }),
        ...(params.fromEmail === undefined ? {} : { from_email: params.fromEmail }),
        ...(params.html === undefined ? {} : { html: params.html }),
        ...(params.replyToMailEngin === undefined ? {} : { reply_to_mailengin: params.replyToMailEngin }),
      },
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });

    return {
      id: response.id,
      from: response.from,
      to: response.to,
      templateName: response.template_name,
      createdAt: response.created_at,
    };
  }

  async sendBulk(
    params: SendBulkEmailParams,
    options: RequestOptions = {},
  ): Promise<SendBulkEmailResponse> {
    requireObject(params, 'sendBulk');

    if (!Array.isArray(params.to) || params.to.length === 0) {
      throw new TypeError('mailengin.emails.sendBulk requires a non-empty to array.');
    }
    if (params.to.length > 1_000) {
      throw new TypeError('mailengin.emails.sendBulk accepts up to 1000 recipients per request.');
    }

    for (const recipient of params.to) {
      const email = typeof recipient === 'string' ? recipient : recipient?.email;
      if (!email?.trim()) {
        throw new TypeError('Every bulk recipient must include a non-empty email address.');
      }
    }
    requireContentSource(params);

    const response = await this.client.post<SendBulkEmailApiResponse>('/api/developer/send-bulk', {
      body: {
        to: params.to.map(toBulkRecipient),
        ...(params.templateName === undefined ? {} : { template_name: params.templateName }),
        ...(params.templateId === undefined ? {} : { template_id: params.templateId }),
        ...(params.variables === undefined ? {} : { variables: params.variables }),
        ...(params.subject === undefined ? {} : { subject: params.subject }),
        ...(params.fromEmail === undefined ? {} : { from_email: params.fromEmail }),
        ...(params.html === undefined ? {} : { html: params.html }),
        ...(params.replyToMailEngin === undefined ? {} : { reply_to_mailengin: params.replyToMailEngin }),
      },
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });

    return {
      success: true,
      jobId: response.jobId,
      queuedCount: response.queued_count,
      ...(response.sent_count === undefined ? {} : { sentCount: response.sent_count }),
      ...(response.failed_count === undefined ? {} : { failedCount: response.failed_count }),
      templateName: response.template_name,
      message: response.message,
    };
  }
}
