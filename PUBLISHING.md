# Publishing MailEngin to npm

This file is for MailEngin maintainers. It is not included in the published npm package.

## One-time setup

1. Create an account at https://www.npmjs.com/signup.
2. Verify the account email address.
3. Enable two-factor authentication for authorization and publishing.
4. Keep npm recovery codes in a secure password manager.
5. Confirm that the package name is still available:

```powershell
npm view mailengin version
```

Before the first publish, npm should return `E404 Not Found`. If another owner claims the name, change `name` in `package.json` to `@mailengin/node` and publish it with `npm publish --access public` instead.

## First publish

Open PowerShell in this package directory:

```powershell
cd D:\Email-SaaS\mailengin-node-sdk
npm login
npm whoami
npm ci
npm run check
npm pack --dry-run
npm publish
```

`npm publish` runs `prepublishOnly`, so type checking, tests, and the build must pass again before npm accepts the release. Enter the current two-factor code if npm prompts for it.

Do not publish with a MailEngin API key, npm token, `.env` file, customer data, or production logs anywhere in the package directory.

## Verify the public package

```powershell
npm view mailengin version
npm view mailengin dist-tags
```

Then test from a different empty folder:

```powershell
mkdir mailengin-sdk-check
cd mailengin-sdk-check
npm init -y
npm install mailengin
node -e "const { MailEngin } = require('mailengin'); console.log(MailEngin.name)"
```

The command should print `MailEngin`. The public package page will be available at https://www.npmjs.com/package/mailengin.

## Publish an update

Every npm version is immutable. Update the version before every later publish:

```powershell
cd D:\Email-SaaS\mailengin-node-sdk
npm version patch
npm publish
```

Use the version command that matches the release:

- `npm version patch`: bug fixes, such as `0.1.0` to `0.1.1`.
- `npm version minor`: backward-compatible features, such as `0.1.0` to `0.2.0`.
- `npm version major`: breaking API changes, such as `1.0.0` to `2.0.0`.

Update `CHANGELOG.md` before publishing. Commit and tag the release in the SDK's source repository so every npm version has auditable source.

## Recommended repository setup

Move this folder into a dedicated public Git repository when the SDK is ready for external contributions, for example `mailengin/mailengin-node`. Then add `repository` and `bugs` fields to `package.json` before the next release.

For automated releases later, use npm trusted publishing with GitHub Actions instead of storing a long-lived npm token.
