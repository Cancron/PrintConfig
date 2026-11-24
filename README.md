# PrintConfig

PrintConfig is an administration platform and API for personalized print products.
It manages product configuration, merchant branding, reusable images and layouts,
saved customer projects, orders, and final production artwork.

## Features

- Products, categories, variants, bulk variant import, option definitions, and pricing modifiers.
- Shared and merchant-specific product configuration with merchant branding and API keys.
- Editor rules, export rules, frontend content, readiness checks, and JSON import/export.
- Print configuration for photo books, collages, pillows, mugs, T-shirts, and standard prints.
- Image library, room previews, collage editor, and multi-page layout templates.
- Saved projects, cart/order processing, persisted generation jobs, print rendering, and ZIP downloads.
- JWT signup/signin and protected admin routes.

Layout and collage administration exists; integration with a separate customer editor
is application-specific. The customer editor itself is not included in this repository.
Signup currently signs users in immediately; email verification, pending approval,
and complete role/ownership enforcement are not implemented.

## Stack

React, TypeScript, Vite, Tailwind CSS, Express, MongoDB/Mongoose, Cloudflare R2,
and an npm-packaged Skia-backed canvas renderer.

## Storage

Cloudflare R2 stores gallery images, customer uploads, saved designs, previews,
order copies, and final prints. The frontend obtains upload authorization from
the backend. MongoDB stores application records.

The current R2 design uses public object URLs. Files uploaded to a public bucket
are publicly addressable; private signed delivery is not implemented for customer files.

## Local Development

Use Node.js 20.20.2 or newer and install dependencies separately in the repository root and backend:

```sh
npm ci
npm --prefix backend ci
```

Direct dependencies are pinned, and both npm projects require releases to be at
least 30 days old when resolving new versions. Commit both lockfiles and use
`npm ci` for reproducible installs. Install scripts are disabled in both npm
projects. The print renderer's native binary (`@napi-rs/canvas`) and esbuild's
platform binary are distributed as npm optional packages, so dependency
installation does not fetch binaries from GitHub or other external hosts.

Create local `.env` files from `.env.example` and `backend/.env.example`.
Configure MongoDB, a random `JWT_SECRET`, and R2 credentials in the backend only.
For root hosting, leave `API_BASE_PATH` empty. Configure `FRONTEND_URL` with
comma-separated browser origins allowed to call the API.

```sh
npm run backend:dev
npm run dev
```

The default frontend is `http://localhost:5173`; the API is
`http://localhost:5000/api`, with health at `/api/health`.

## Environment Variables

| Backend variable | Purpose |
| --- | --- |
| `PORT` | HTTP listening port; default 5000. |
| `API_BASE_PATH` | Optional externally forwarded application prefix, such as `/printconfig`. |
| `ADMIN_STATIC_DIR` | Optional frontend build directory; default `backend/public/admin`. |
| `FRONTEND_URL` | Allowed browser origins; include deployed admin/editor origins. |
| `MONGODB_URI` | MongoDB connection string. |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Optional database name and separate credentials. |
| `JWT_SECRET` | Required signing secret; no development fallback. |
| `CLOUDFLARE_ACCOUNT_ID` | R2 account identifier. |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Server-side S3 credentials. |
| `CLOUDFLARE_R2_BUCKET` | Existing R2 bucket name; default `printconfig`. |
| `CLOUDFLARE_PUBLIC_DEV_URL` | Public R2 base URL or production custom-domain URL. |
| `R2_SIGNED_UPLOAD_TTL_SECONDS` | Upload URL expiry; default 900 seconds. |

`CLOUDFLARE_TOKEN` is not used by normal storage operations. Keep it out of the
frontend. Frontend settings are only `VITE_API_URL` and `VITE_BASE_PATH`.
Never put passwords, service-role keys, or signing secrets in `VITE_*` variables.

## Build and Deployment

For a standalone frontend, `npm run build` creates `dist`. Set `VITE_BASE_PATH`
and `VITE_API_URL` before building. `npm run backend:build` compiles the API.

To deploy only the backend folder, run:

```sh
npm run build:deploy
```

This reads the backend `API_BASE_PATH`, builds the admin into
`backend/public/admin`, and compiles the server into `backend/dist`.
With no prefix, URLs are `/admin/` and `/api`. With `/printconfig`, they become
`/printconfig/admin/` and `/printconfig/api`.

The deployment build uses extensionless asset URLs handled by Express to accommodate
shared hosts that intercept file-extension requests. The physical asset folder is `_assets`.
Upload generated `dist` and `public/admin` together. Install production dependencies
on the target server with `npm ci --omit=dev`, then run `npm start` from `backend`.
Never upload Windows `node_modules` to Linux: the renderer includes a native binary.
Rebuild and restart when changing the deployment prefix.

See [DEPLOY_RENDER.md](DEPLOY_RENDER.md) for hosting and CORS configuration.

## Verification and Maintenance

```sh
npm run typecheck
npm run backend:typecheck
npm run lint
npm --prefix backend run test:mongo
npm --prefix backend run test:mongo-network
```

MongoDB diagnostics write logs under `backend/logs` when run through these commands.
Network tests check DNS, TCP, and TLS; `test:mongo` also verifies authentication and ping.

Jobs are persisted in MongoDB, but execution currently starts in the API process.
A separate durable worker and automatic interrupted-job recovery are future work.

## Credentials and Access

Local `.env` files, generated builds, logs, and private-key files are excluded from Git.
Password hashes and merchant signing secrets remain backend-only; ordinary JSON
serialization omits them. API-key rotation intentionally returns the new key once.
If real credentials were previously committed, removing them from current files does
not revoke them or remove them from Git history; rotate them at the provider.
