export type Variables = Record<string, unknown>;

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface MailEnginOptions {
  /** Full MailEngin API key beginning with re_. Keep this value server-side. */
  apiKey: string;
  /** API origin without a trailing slash. Defaults to https://api.mailengin.app. */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 30 seconds. */
  timeoutMs?: number;
  /** Optional fetch implementation, primarily useful for testing. */
  fetch?: FetchLike;
}

export interface RequestOptions {
  /** Cancels this request when the signal is aborted. */
  signal?: AbortSignal;
}

export interface SendEmailParams {
  to: string;
  /** Published template API name (slug) or exact display name. */
  templateName?: string;
  /** Legacy template identifier. Prefer templateName for stable integrations. */
  templateId?: string;
  variables?: Variables;
  /** Optional override for the template subject. Required for raw HTML sends. */
  subject?: string;
  /** Optional verified sender override. */
  fromEmail?: string;
  /** Advanced fallback for one-off sends without a template. */
  html?: string;
  /** Route replies into the MailEngin inbox. */
  replyToMailEngin?: boolean;
}

export interface SendEmailResponse {
  id: string;
  from: string;
  to: string;
  templateName: string | null;
  createdAt: string;
}

export interface BulkRecipient {
  email: string;
  variables?: Variables;
}

export interface SendBulkEmailParams {
  to: Array<string | BulkRecipient>;
  /** Published template API name (slug) or exact display name. */
  templateName?: string;
  /** Legacy template identifier. Prefer templateName for stable integrations. */
  templateId?: string;
  /** Variables shared by every recipient. Recipient variables take precedence. */
  variables?: Variables;
  /** Optional override for the template subject. Required for raw HTML sends. */
  subject?: string;
  /** Optional verified sender override. */
  fromEmail?: string;
  /** Advanced fallback for one-off sends without a template. */
  html?: string;
  /** Route replies into the MailEngin inbox. */
  replyToMailEngin?: boolean;
}

export interface SendBulkEmailResponse {
  success: true;
  jobId: string;
  queuedCount: number;
  sentCount?: number;
  failedCount?: number;
  templateName: string | null;
  message: string;
}

export interface MailEnginApiErrorBody {
  success?: false;
  message?: string;
  code?: string;
  [key: string]: unknown;
}
