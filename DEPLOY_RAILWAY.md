# Deploy GitHunter to Railway

You can deploy **backend only** (API) or **backend + frontend** (one URL for the full app).

## Prerequisites

- A [Railway](https://railway.app) account (GitHub login works)
- Your repo pushed to GitHub
- **Redis**: Railway provides a Redis add-on (recommended for cache and job queue)

---

## Choose deployment style

| Style | Root Directory | Result |
|-------|----------------|--------|
| **Full stack (recommended)** | Leave blank or `/` | API + frontend. Open **ReportView** at `https://your-app.up.railway.app/ReportView.html` (or `/` → redirects there). |
| **Backend only** | `backend` | API only. Use the frontend locally or elsewhere and set `window.API_BASE` to your Railway URL. |

The steps below assume **full stack** so you can open the report view in the browser. For backend-only, set Root Directory to `backend` and skip the root-directory step.

---

## 1. Create a new project and service

1. Go to [railway.app](https://railway.app) and sign in.
2. **New Project** → **Deploy from GitHub repo**.
3. Select your **GitHunter** repository.
4. Railway will create a service.

---

## 2. Root directory (for full-stack: leave default)

- **Full stack:** Leave **Root Directory** blank (or `/`). The repo-root `railway.toml` will build the backend, copy the frontend into `backend/public`, and serve both. You’ll access the app at `https://your-app.up.railway.app/ReportView.html` (or `/`).
- **Backend only:** Set **Root Directory** to `backend`. Only the API is deployed; use the frontend elsewhere and point it at your Railway URL.

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
2. **Full stack:** Railway runs the build from repo root (installs backend deps, copies `frontend/` → `backend/public/`), then starts with `cd backend && node index.js`.
3. **Backend only:** Railway runs `npm install` and `npm start` from `backend/`.
4. After the build finishes, open **Settings** → **Networking** → **Generate domain** to get a URL like `https://your-app.up.railway.app`.

---

## 6. Accessing the frontend (ReportView)

- **Full-stack deploy:**  
  - **Report view:** `https://your-app.up.railway.app/ReportView.html`  
  - **Enterprise dashboard:** `https://your-app.up.railway.app/EnterpriseView.html`  
  - **Root:** `https://your-app.up.railway.app/` redirects to ReportView.  
  The frontend uses the same origin for the API, so no extra config is needed.

- **Backend-only deploy:**  
  Open the HTML files locally (or host them on Vercel/Netlify). In each page, before `script.js`, set the API base:
  ```html
  <script>window.API_BASE = "https://your-app.up.railway.app";</script>
  ```

---

## 7. Config as code

- **Full stack:** Repo-root `railway.toml` defines the build (install + copy frontend) and start command; Railway uses it when Root Directory is repo root.
- **Backend only:** `backend/railway.toml` sets the health check on `/`. With Root Directory = `backend`, Railway uses it automatically.

---

## Troubleshooting

- **Build fails**  
  - Full stack: ensure Root Directory is blank so repo-root `railway.toml` is used, and that `backend/` and `frontend/` exist.  
  - Backend only: set Root Directory to `backend` and ensure `backend/package.json` and `backend/index.js` exist.

- **App crashes or “Redis connection” errors**  
  Add the Redis add-on and set `REDIS_URL` in the backend service variables.

- **CORS**  
  The backend allows all origins (`origin: "*"`). If you restrict this later, add your frontend origin (e.g. your Vercel/Netlify or Railway frontend URL).

- **Slides / Supabase / GitHub**  
  Ensure the corresponding env vars are set in Railway; the app skips those features if keys are missing.
