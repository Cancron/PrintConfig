# Deploy PrintConfig

## Backend With Embedded Admin

Configure `.env` using `.env.example`. Use a real MongoDB URI,
a generated `JWT_SECRET`, the existing R2 bucket name, and public asset base URL.
Set `FRONTEND_URL` to your admin/editor browser origins.

From the repository root:

```sh
npm ci
npm --prefix frontend ci
npm run build
```

Upload the application, including `dist/` and `frontend/dist/`, without local
`node_modules`, local credentials, or diagnostic logs. Configure server secrets
through the hosting environment, or a backend-only `.env` file.

Install dependencies on the target operating system:

```sh
npm ci --omit=dev
npm start
```

Use `dist/server.js` as the cPanel startup file. The renderer's Linux native
binary is supplied by an npm optional package (`@napi-rs/canvas-linux-x64-gnu`
or its platform equivalent), not downloaded from GitHub.
A Windows binary causes
an `invalid ELF header` startup failure. Do not overwrite a cPanel-managed
`node_modules` symlink with an uploaded folder.

## URL Prefixes

Leave `API_BASE_PATH` empty to use `/admin/` and `/api/health`.
If your host forwards a prefix such as `/printconfig`, set
`API_BASE_PATH=/printconfig` before building and on the server. URLs become
`/printconfig/admin/` and `/printconfig/api/health`.

The frontend build derives asset, router, and API paths from this backend
setting. Restart Node after deployment. Express serves the build directly from
`frontend/dist`, including extensionless asset URLs for shared hosts.
Upload the entire build together with `dist`.

## Render

The example `render.yaml` defines one backend web service that also serves the
admin frontend. Supply all environment values marked `sync: false`; keep secrets
in backend environment settings only.

## R2 Storage

Set `CLOUDFLARE_R2_BUCKET` explicitly to your existing bucket; the example default
is `printconfig`. This does not rename any existing Cloudflare bucket.

Edit `cloudflare-r2-cors.json` to include production admin origins before applying:

```sh
npx wrangler r2 bucket cors set YOUR_BUCKET --file cloudflare-r2-cors.json
npx wrangler r2 bucket cors list YOUR_BUCKET
```

This requires Cloudflare bucket-configuration permission. Browser uploads require
`PUT` and `Content-Type`; image display requires `GET`/`HEAD`. The sample permits
public reads; it does not make customer files private. Use a custom asset domain
for production and keep storage credentials on the backend.

## Troubleshooting

- `503`: inspect Node startup logs; verify dependencies, native binaries,
  MongoDB access, startup file, and hosting process configuration.
- API returns HTML: verify proxy mapping and the frontend API base URL.
- Asset `404`: upload the complete matching admin build and compiled backend.
- MongoDB failures: run `npm run test:mongo` and `npm run test:mongo-network`
  inside `backend`. The host must permit outbound TCP to the Atlas cluster.
- Browser CORS failure: configure both backend `FRONTEND_URL` and R2 bucket CORS.
