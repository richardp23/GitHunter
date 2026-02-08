# Google Slides Export — OAuth Setup (Recommended)

This guide configures Google Slides export using **OAuth** instead of a service account. OAuth is recommended for personal Gmail accounts and avoids the service account Drive quota issue.

## Why OAuth?

Service accounts have very limited or no usable Google Drive storage. When GitHunter tries to create presentations with a service account, Google returns:

- **Drive API**: `storageQuotaExceeded` — the service account's Drive is full
- **Slides API**: generic 403 "The caller does not have permission"

With **OAuth**, presentations are created in the authenticated user's Drive, which has normal quota (15GB for free accounts). No Google Workspace or shared folder setup is required.

## Prerequisites

- A Google account (personal Gmail works)
- Access to [Google Cloud Console](https://console.cloud.google.com)

## Step 1: Create an OAuth Desktop Client in GCP

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select or create a project
3. **Enable APIs**:
   - APIs & Services → Library
   - Search for **Google Slides API** → Enable
   - Search for **Google Drive API** → Enable
4. **Create credentials**:
   - APIs & Services → Credentials → Create Credentials → **OAuth client ID**
   - If prompted, configure the OAuth consent screen:
     - User type: **External** (for personal Gmail)
     - App name: e.g. "GitHunter"
     - Add your email as a test user (for development)
   - Application type: **Desktop app**
   - Name: e.g. "GitHunter Slides"
   - Click **Create**
5. Copy the **Client ID** and **Client secret**

## Step 2: Add Client ID and Secret to .env

Create or edit `backend/.env`:

```env
GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
```

## Step 3: Get a Refresh Token

Run the one-time token script:

```bash
cd backend
node scripts/obtain-google-oauth-token.js
```

1. The script prints a URL — open it in your browser
2. Sign in with the Google account whose Drive should hold the slides
3. Grant the requested permissions (Drive and Slides)
4. Copy the authorization code from the browser
5. Paste it into the terminal when prompted
6. The script prints `GOOGLE_OAUTH_REFRESH_TOKEN=...`

## Step 4: Add Refresh Token to .env

Add the printed line to `backend/.env`:

```env
GOOGLE_OAUTH_REFRESH_TOKEN=1//0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

You can leave service account vars (`GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_SERVICE_ACCOUNT_JSON`) unset — OAuth takes priority when all three OAuth vars are present.

## Step 5: Verify

Run the diagnostic script:

```bash
cd backend
node scripts/log-slides-error.js
```

You should see:

```
OAuth refresh token is set. Creating presentation as that user ...
   Success. Presentation ID: ...
   Deleted. OAuth path works.
```

## Summary of Required .env Variables

```env
GOOGLE_OAUTH_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=xxx
GOOGLE_OAUTH_REFRESH_TOKEN=1//0xxx
```

## Optional: Service Account Fallback

If you have a Google Workspace domain, you can use domain-wide delegation (`SLIDES_IMPERSONATE_EMAIL`) instead. For most users, OAuth is simpler and works with personal Gmail.

## Troubleshooting

- **No refresh_token in response**: Revoke app access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions), then run the obtain script again and consent to all requested scopes.
- **403 on create**: Ensure Google Slides API and Google Drive API are enabled in the same GCP project as your OAuth client.
- **"Slides API is not configured"**: Check that all three OAuth vars are set in `.env`.
