# Deploy GitHunter to Railway

This guide deploys the **backend** (Node/Express API) to Railway. The frontend can be served from the same app (optional) or hosted elsewhere and pointed at your Railway API URL.

## Prerequisites

- A [Railway](https://railway.app) account (GitHub login works)
- Your repo pushed to GitHub
- **Redis**: Railway provides a Redis add-on (recommended for cache and job queue)

---

## 1. Create a new project and service

1. Go to [railway.app](https://railway.app) and sign in.
2. **New Project** → **Deploy from GitHub repo**.
3. Select your **GitHunter** repository.
4. Railway will create a service. **Do not deploy yet**—set the root directory first.

---

## 2. Set root directory to `backend`

The app entry point and `package.json` live in the `backend/` folder.

1. Open your **service** → **Settings**.
2. Under **Source**, set **Root Directory** to: `backend`.
3. Save. Railway will build and run from `backend/` (so `npm install` and `node index.js` run there).

---

## 3. Add Redis (recommended)

The app uses Redis for caching and the analysis job queue. Without it, some features may be limited.

1. In the same **project**, click **+ New** → **Database** → **Add Redis**.
2. Open the new Redis service → **Variables** (or **Connect**) and copy the `REDIS_URL` (or `REDIS_PRIVATE_URL`).
3. In your **backend service** → **Variables**, add:
   - Name: `REDIS_URL`
   - Value: paste the Redis URL (e.g. `redis://default:...@...railway.app:port`).

Railway can also **reference** the Redis variable from the Redis service so the value stays in sync; use **Add Variable** → **Add Reference** and pick the Redis service’s `REDIS_URL` if available.

---

## 4. Set environment variables

In your **backend service** → **Variables**, add the following. Copy from your local `backend/.env` where applicable.

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Recommended | [GitHub PAT](https://github.com/settings/tokens) — higher API rate limit (5000/hr vs 60/hr). |
| `GEMINI_API_KEY` | Yes (for AI) | [Google AI Studio](https://aistudio.google.com/apikey) — used for analysis. |
| `REDIS_URL` | Yes (recommended) | Set in step 3 from Railway Redis. |
| `SUPABASE_URL` | Optional | Your Supabase project URL (for report archive / enterprise portal). |
| `SUPABASE_SECRET_KEY` | Optional | Supabase secret key (see `backend/docs/SUPABASE_SETUP.md`). |
| `GOOGLE_OAUTH_CLIENT_ID` | Optional | For Google Slides generation (see `backend/docs/GOOGLE_SLIDES_OAUTH_SETUP.md`). |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Optional | |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Optional | |

**Note:** `PORT` is set automatically by Railway; you do not need to add it.

---

## 5. Deploy

1. Commit and push any changes (or trigger a redeploy from the Railway dashboard).
2. Railway will run `npm install` and then `npm start` (i.e. `node index.js`) from the `backend/` root.
3. After the build finishes, open **Settings** → **Networking** → **Generate domain** to get a URL like `https://your-app.up.railway.app`.

Visiting that URL should return `{ "ok": true, "service": "git-hunter-api" }` if the backend is running.

---

## 6. Use the API from the frontend

- **Option A – Frontend elsewhere (e.g. local or Vercel/Netlify)**  
  Point the frontend at your Railway API URL. In your HTML (before `script.js`), set:
  ```html
  <script>window.API_BASE = "https://your-app.up.railway.app";</script>
  ```
  Or build the frontend with this value as a config / env (e.g. `VITE_API_URL` if using Vite).

- **Option B – Serve frontend from the same Railway service**  
  1. In your build (e.g. a custom build command or a deploy script), copy the repo’s `frontend/` contents into `backend/public/` (e.g. `cp -r ../frontend/* public/` or `xcopy /E /I ..\frontend public` on Windows).  
  2. Set **Root Directory** to the repo root and use a **Custom Build Command** that installs backend deps and copies frontend into `backend/public`, then set **Start Command** to `cd backend && node index.js`.  
  3. Or keep Root Directory as `backend` and add a **build step** that pulls the frontend from the parent directory (e.g. in `package.json`: `"build": "node -e \"require('fs').cpSync('../frontend', 'public', {recursive:true})\""` only if you configure the build context to include the parent).  
  The simplest approach is to copy `frontend/` into `backend/public/` in your CI or locally before pushing, then deploy with Root Directory = `backend`. The app will serve `public/` at `/` and use the same origin for API calls.

---

## 7. Optional: config as code

A `backend/railway.toml` is included so the deploy uses a health check on `/`. If you use a custom config file path in Railway, point it to `backend/railway.toml`. With Root Directory set to `backend`, Railway will pick it up automatically.

---

## Troubleshooting

- **Build fails**  
  Ensure **Root Directory** is `backend` and that `backend/package.json` and `backend/index.js` exist.

- **App crashes or “Redis connection” errors**  
  Add the Redis add-on and set `REDIS_URL` in the backend service variables.

- **CORS**  
  The backend allows all origins (`origin: "*"`). If you restrict this later, add your frontend origin (e.g. your Vercel/Netlify or Railway frontend URL).

- **Slides / Supabase / GitHub**  
  Ensure the corresponding env vars are set in Railway; the app skips those features if keys are missing.
