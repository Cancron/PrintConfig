# Deploy Canadaprintstudio to Render

## Prerequisites

- Push this repository to GitHub, GitLab, or Bitbucket.
- Create a MongoDB Atlas database or another publicly reachable MongoDB deployment.
- Keep the existing Supabase project and public `gallery` bucket.

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
```

`SUPABASE_SERVICE_ROLE_KEY` belongs only on the backend service.

If the database name is not included in `MONGODB_URI`, also set:

```text
DB_NAME=your_database_name
```

## Frontend environment variables

Set these on `canadaprintstudio-admin`:

```text
VITE_API_URL=https://canadaprintstudio-api.onrender.com/api
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_SUPABASE_GALLERY_BUCKET=gallery
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
- Confirm the Supabase `gallery` bucket is public.
- Confirm Storage policies allow authenticated/anonymous frontend uploads as intended.
- Never add the Supabase service-role key to frontend environment variables.

## Smoke tests

```text
https://YOUR_API.onrender.com/api/health
https://YOUR_FRONTEND.onrender.com
https://YOUR_FRONTEND.onrender.com/products
https://YOUR_FRONTEND.onrender.com/image-library
```

The API health endpoint should return HTTP 200. Refreshing a nested frontend route should load the app instead of returning 404.
