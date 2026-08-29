# Deploy Canadaprintstudio to Render

## Prerequisites

- Push this repository to GitHub, GitLab, or Bitbucket.
- Create a MongoDB Atlas database or another publicly reachable MongoDB deployment.
- Create the Cloudflare R2 bucket `canadaprintstudio` and enable its public development URL (or attach a production custom domain).
- Keep the existing Supabase project temporarily if legacy files still need to be migrated.

## Deploy with the Blueprint

1. Open the Render Dashboard.
2. Select **New > Blueprint**.
3. Connect this repository.
4. Render detects `render.yaml` and creates:
   - `canadaprintstudio-api`: Node/Express web service
   - `canadaprintstudio-admin`: Vite static site
5. Enter all environment variables marked `sync: false`.

## Backend environment variables

Set these on `canadaprintstudio-api`:

```text
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER/DATABASE
FRONTEND_URL=https://canadaprintstudio-admin.onrender.com
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_GALLERY_BUCKET=gallery
CLOUDFLARE_ACCOUNT_ID=YOUR_CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_R2_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
CLOUDFLARE_R2_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
CLOUDFLARE_PUBLIC_DEV_URL=https://pub-YOUR_ID.r2.dev
CLOUDFLARE_R2_BUCKET=canadaprintstudio
R2_SIGNED_UPLOAD_TTL_SECONDS=900
```

Cloudflare R2 credentials and `SUPABASE_SERVICE_ROLE_KEY` belong only on the backend service. `CLOUDFLARE_TOKEN` is not required for normal S3-compatible storage operations.

If the database name is not included in `MONGODB_URI`, also set:

```text
DB_NAME=your_database_name
```

## Frontend environment variables

Set these on `canadaprintstudio-admin`:

```text
VITE_API_URL=https://canadaprintstudio-api.onrender.com/api
```

Vite variables are embedded during the build. Redeploy the static site after changing them.

## Final URL pass

Render service names must be globally unique. If Render changes either service name:

1. Copy the actual API URL into frontend `VITE_API_URL`, adding `/api`.
2. Copy the actual static-site URL into backend `FRONTEND_URL`.
3. Redeploy both services.

## External service checks

- In MongoDB Atlas Network Access, allow connections from Render's outbound IP ranges.
- Confirm the MongoDB user has access to the selected database.
- Configure R2 bucket CORS to allow `PUT` from the admin frontend and `GET`/`HEAD` from sites that display the assets. Allow the `Content-Type` request header.
- Confirm `CLOUDFLARE_PUBLIC_DEV_URL` does not end with a slash.
- Never add R2 access keys, Cloudflare tokens, or the Supabase service-role key to frontend environment variables.

Apply the included policy with a Cloudflare token that can edit R2 bucket configuration:

```powershell
npx wrangler r2 bucket cors set canadaprintstudio --file cloudflare-r2-cors.json
npx wrangler r2 bucket cors list canadaprintstudio
```

Add any additional production admin domains to `cloudflare-r2-cors.json` before applying it. Object read access remains available to all origins because the bucket stores public product assets.

## Supabase migration

Run from the repository root after deploying the R2 configuration:

```powershell
npm.cmd --prefix backend run migrate:supabase-to-r2 -- --dryRun
npm.cmd --prefix backend run migrate:supabase-to-r2 -- --apply
npm.cmd --prefix backend run migrate:supabase-to-r2 -- --verify
```

Back up MongoDB before `--apply`. The migration copies and verifies all files before changing database references. Keep the Supabase backend variables during the fallback period; remove them after migration verification.

## Smoke tests

```text
https://YOUR_API.onrender.com/api/health
https://YOUR_FRONTEND.onrender.com
https://YOUR_FRONTEND.onrender.com/products
https://YOUR_FRONTEND.onrender.com/image-library
```

The API health endpoint should return HTTP 200. Refreshing a nested frontend route should load the app instead of returning 404.
