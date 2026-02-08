# Supabase setup for GitHunter enterprise archive

The backend uses Supabase only as **long-term storage** for reports (table `archived_reports`). The app works without it; if env vars are unset, archiving is skipped and the enterprise list is empty.

## 1. Create a Supabase project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. **New project** → choose org, name, database password, region.
3. Wait for the project to be ready.

## 2. Create the table

In the Supabase dashboard: **SQL Editor** → **New query**, then run:

```sql
create table if not exists archived_reports (
  username text primary key,
  report   jsonb not null,
  created_at timestamptz default now()
);

comment on table archived_reports is 'Long-term archive of GitHunter reports; keyed by GitHub username.';
```

Then click **Run**.

## 3. Get URL and API key

1. In the dashboard, open **Project Settings** (gear icon) → **API**.
2. **Project URL** → copy (e.g. `https://xxxxxxxx.supabase.co`). This is `SUPABASE_URL`.
3. **API key** (use one of these):
   - **Recommended:** Under **"Publishable and secret API keys"**, copy the **Secret key** (starts with `sb_secret_...`). Use it as `SUPABASE_SECRET_KEY`. This is the [new key format](https://github.com/orgs/supabase/discussions/29260); same elevated access as the legacy service_role, with better rotation and security.
   - **Legacy:** Under **"Legacy anon, service_role API keys"**, reveal and copy the **service_role** key (JWT). Use it as `SUPABASE_SERVICE_ROLE_KEY`. Still supported but considered legacy.

**Important:** The secret/service_role key bypasses Row Level Security. Use it only on the backend; never expose it in the frontend.

## 4. Configure the backend

In the backend `.env` (or your deployment env):

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
# Prefer the new secret key:
SUPABASE_SECRET_KEY=sb_secret_...
# Or legacy:
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The app uses `SUPABASE_SECRET_KEY` if set, otherwise `SUPABASE_SERVICE_ROLE_KEY`. Restart the backend. New analyses will be written to `archived_reports` after each run; the enterprise portal lists and loads from this table (via Redis when possible).

## 5. (Optional) Row Level Security

If you enable RLS on `archived_reports`, add a policy that allows full access for the role used by your API key (secret keys assume the same privileges as service_role). The Node app uses the configured key, so it will still work. RLS mainly affects anon/publishable usage from the Supabase client if you ever use it from the frontend.
