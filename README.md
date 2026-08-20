# MailEngin Node.js SDK

[![npm version](https://img.shields.io/npm/v/mailengin.svg)](https://www.npmjs.com/package/mailengin)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-3178c6.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-111827.svg)](./LICENSE)

The official Node.js and TypeScript SDK for sending transactional email with [MailEngin](https://mailengin.app).

Create and publish a reusable Developer Template in MailEngin, then send it from your application using its API name and variables. No email HTML needs to live in your codebase.

## Installation

```bash
npm install mailengin
```

**Requirements:** Node.js 18 or newer.

> **Important:** This SDK is for server-side applications only. Never expose a MailEngin API key in browser, mobile, or other client-side code.

## Before You Send

1. [Verify a sending domain](https://mailengin.app/dashboard/domains).
2. Choose a sender address on that domain, such as `hello@yourdomain.com`.
3. [Create an API key](https://mailengin.app/dashboard/api-keys) and securely save the full secret.
4. [Create and publish a Developer Template](https://mailengin.app/dashboard/dev-templates).
5. Copy the template's **API name**, such as `welcome-email`.

Store the API key in a server-side environment variable:

```env
MAILENGIN_API_KEY=re_your_full_secret_key
```

MailEngin shows the full key only once. A masked key cannot authenticate API requests.

## Quickstart

```js
import { MailEngin } from 'mailengin';

const mailengin = new MailEngin({
  apiKey: process.env.MAILENGIN_API_KEY,
});

const email = await mailengin.emails.send({
  to: 'user@example.com',
  fromEmail: 'hello@yourdomain.com',
  templateName: 'welcome-email',
  variables: {
    first_name: 'Vishvesh',
  },
});

console.log(email.id);
```

The published template supplies the HTML and subject. Variables such as `{{first_name}}` are replaced for the recipient.

## How the Sender Is Selected

MailEngin does not prompt for a domain because the SDK runs inside non-interactive servers, background jobs, and serverless functions. Supply the complete sender address with `fromEmail`:

```js
await mailengin.emails.send({
  to: 'user@example.com',
  fromEmail: 'hello@yourdomain.com',
  templateName: 'welcome-email',
});
```

The sender is resolved in this order:

1. `fromEmail` provided in the SDK request.
2. The sender saved in the published Developer Template.
3. `noreply@<authorized-domain>` as a fallback.

The domain in `fromEmail` must be verified in MailEngin and authorized for the API key. For predictable production sends, set a sender in the template or provide `fromEmail` explicitly.

## Send One Email

```js
const result = await mailengin.emails.send({
  to: 'customer@example.com',
  fromEmail: 'hello@yourdomain.com',
  templateName: 'account-verification',
  variables: {
    first_name: 'Asha',
    verification_url: 'https://yourapp.com/verify/token',
  },
  replyToMailEngin: true,
});

console.log(result);
```

Example response:

```js
{
  id: '010901a0...',
  from: 'hello@yourdomain.com',
  to: 'customer@example.com',
  templateName: 'account-verification',
  createdAt: '2026-08-20T10:30:00.000Z'
}
```

### Send options

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `to` | `string` | Yes | Recipient email address. |
| `templateName` | `string` | Recommended | Published template API name or exact display name. |
| `variables` | `object` | No | Values used to replace template variables. |
| `subject` | `string` | No | Overrides the template subject. |
| `fromEmail` | `string` | Recommended | Complete sender address on a verified, API-key-authorized domain. |
| `replyToMailEngin` | `boolean` | No | Routes replies into the MailEngin inbox. |
| `html` | `string` | Advanced | Raw HTML fallback when no template is used. |

## Send Personalized Bulk Email

Bulk requests accept up to 1,000 recipients. Shared variables apply to every recipient, while recipient variables take precedence.

```js
const job = await mailengin.emails.sendBulk({
  to: [
    {
      email: 'asha@example.com',
      variables: { first_name: 'Asha' },
    },
    {
      email: 'ben@example.com',
      variables: { first_name: 'Ben' },
    },
  ],
  fromEmail: 'hello@yourdomain.com',
  templateName: 'product-update',
  variables: {
    product_name: 'MailEngin',
  },
});

console.log(job.jobId, job.queuedCount);
```

For the same content without personalization, pass email strings directly:

```js
await mailengin.emails.sendBulk({
  to: ['a@example.com', 'b@example.com'],
  templateName: 'maintenance-notice',
});
```

## Override Template Fields

You may override a published template's subject or sender for one request:

```js
await mailengin.emails.send({
  to: 'user@example.com',
  templateName: 'welcome-email',
  subject: 'Welcome to the pro plan',
  fromEmail: 'onboarding@yourdomain.com',
});
```

The sender must belong to a verified domain authorized for the API key.

## Advanced: Send Raw HTML

Published templates are recommended for reusable application email. For a one-off message, provide both `subject` and `html`:

```js
await mailengin.emails.send({
  to: 'user@example.com',
  subject: 'Your report is ready',
  html: '<h1>Report ready</h1><p>You can download it now.</p>',
  fromEmail: 'reports@yourdomain.com',
});
```

## Error Handling

API, timeout, cancellation, and network failures throw `MailEnginError`.

```js
import { MailEnginError } from 'mailengin';

try {
  await mailengin.emails.send({
    to: 'user@example.com',
    templateName: 'welcome-email',
  });
} catch (error) {
  if (error instanceof MailEnginError) {
    console.error(error.message);
    console.error(error.status);      // HTTP status, when available
    console.error(error.requestId);   // Include when contacting support
    console.error(error.retryAfter);  // Seconds to wait after HTTP 429
    console.error(error.isRetryable);
  }
}
```

The SDK does not automatically retry sends, preventing accidental duplicate email until API idempotency keys are available.

## Configuration

```js
const mailengin = new MailEngin({
  apiKey: process.env.MAILENGIN_API_KEY,
  timeoutMs: 15_000,
});
```

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | None | Full server-side MailEngin API key. |
| `baseUrl` | `https://api.mailengin.app` | Override only for local or dedicated environments. |
| `timeoutMs` | `30000` | Request timeout in milliseconds. |
| `fetch` | Native `fetch` | Optional custom fetch implementation for testing. |

### Cancellation

```js
const controller = new AbortController();

await mailengin.emails.send(
  {
    to: 'user@example.com',
    templateName: 'welcome-email',
  },
  { signal: controller.signal },
);
```

## CommonJS

```js
const { MailEngin } = require('mailengin');

const mailengin = new MailEngin(process.env.MAILENGIN_API_KEY);
```

## TypeScript

Type declarations are bundled with the package. Commonly used exports include:

- `MailEnginOptions`
- `SendEmailParams`
- `SendEmailResponse`
- `SendBulkEmailParams`
- `SendBulkEmailResponse`
- `BulkRecipient`
- `Variables`

```ts
import { MailEngin, type SendEmailParams } from 'mailengin';

const message: SendEmailParams = {
  to: 'user@example.com',
  templateName: 'welcome-email',
};
```

## Resources

- [API Documentation](https://mailengin.app/dashboard/docs)
- [Developer Templates](https://mailengin.app/dashboard/dev-templates)
- [API Keys](https://mailengin.app/dashboard/api-keys)
- [Webhooks](https://mailengin.app/dashboard/webhooks)
- [Report an Issue](https://github.com/vishveshrathore/mailengin-node-sdk/issues)

## License

Released under the [MIT License](./LICENSE).
