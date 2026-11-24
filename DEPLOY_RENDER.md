# Deploy PrintConfig

## Backend With Embedded Admin

Configure `backend/.env` using `backend/.env.example`. Use a real MongoDB URI,
a generated `JWT_SECRET`, the existing R2 bucket name, and public asset base URL.
Set `FRONTEND_URL` to your admin/editor browser origins.

From the repository root:

```sh
npm ci
npm --prefix backend ci
npm run build:deploy
```

Upload `backend/`, including `dist/` and `public/admin/`, without local
`node_modules`, local credentials, or diagnostic logs. Configure server secrets
through the hosting environment, or a backend-only `.env` file.

Install dependencies on the target operating system:

```sh
npm ci --omit=dev
npm start
```

Use `dist/server.js` as the cPanel startup file. Skia Canvas installation scripts
must run on the server to download its Linux native binary from GitHub releases.
The package checks the downloaded binary against its published SHA-256 hash.
A Windows binary causes
an `invalid ELF header` startup failure. Do not overwrite a cPanel-managed
`node_modules` symlink with an uploaded folder.

## URL Prefixes

Leave `API_BASE_PATH` empty to use `/admin/` and `/api/health`.
If your host forwards a prefix such as `/printconfig`, set
`API_BASE_PATH=/printconfig` before building and on the server. URLs become
`/printconfig/admin/` and `/printconfig/api/health`.

`npm run build:deploy` derives frontend asset, router, and API paths from this
backend setting. Restart Node after deployment. The deployment build serves
extensionless asset URLs through Express and stores files under
`backend/public/admin/_assets`. Upload the entire build together.

## Separate Frontend

For separate static hosting, configure frontend `VITE_API_URL` with the API URL
including `/api`, and `VITE_BASE_PATH` with its hosting prefix or an empty value.
Run `npm run build` and deploy `dist/`. Configure an SPA fallback to `index.html`.
The included `.htaccess` supports Apache-compatible static hosting.

## Render

The example `render.yaml` defines `printconfig-api` and `printconfig-admin`.
Service names are examples; renaming existing services requires a deliberate
hosting change. Set frontend `VITE_API_URL` to the deployed API address and backend
`FRONTEND_URL` to the frontend origin. Supply all environment values marked
`sync: false`; keep secrets in backend environment settings only.

## R2 and Legacy Supabase

Set `CLOUDFLARE_R2_BUCKET` explicitly to your existing bucket; the example default
is `printconfig`. This does not rename any existing Cloudflare bucket.
New uploads use R2. Supabase variables are optional and only needed for legacy
read/delete/copy operations and migration.

Edit `cloudflare-r2-cors.json` to include production admin origins before applying:

```sh
npx wrangler r2 bucket cors set YOUR_BUCKET --file cloudflare-r2-cors.json
npx wrangler r2 bucket cors list YOUR_BUCKET
```

This requires Cloudflare bucket-configuration permission. Browser uploads require
`PUT` and `Content-Type`; image display requires `GET`/`HEAD`. The sample permits
public reads; it does not make customer files private. Use a custom asset domain
for production and keep storage credentials on the backend.

Before migrating Supabase data, back up MongoDB and run:

```sh
npm --prefix backend run migrate:supabase-to-r2 -- --dryRun
npm --prefix backend run migrate:supabase-to-r2 -- --apply
npm --prefix backend run migrate:supabase-to-r2 -- --verify
```

Retain Supabase credentials/files until production verification is complete.

## Troubleshooting

- `503`: inspect Node startup logs; verify dependencies, native binaries,
  MongoDB access, startup file, and hosting process configuration.
- API returns HTML: verify proxy mapping and the frontend API base URL.
- Asset `404`: upload the complete matching admin build and compiled backend.
- MongoDB failures: run `npm run test:mongo` and `npm run test:mongo-network`
  inside `backend`. The host must permit outbound TCP to the Atlas cluster.
- Browser CORS failure: configure both backend `FRONTEND_URL` and R2 bucket CORS.
