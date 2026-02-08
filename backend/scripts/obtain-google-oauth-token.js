/**
 * One-time: get a Google OAuth refresh token for Drive + Slides (user quota, no Workspace).
 * Run: node scripts/obtain-google-oauth-token.js
 *
 * 1. In GCP Console → APIs & Services → Credentials → Create credentials → OAuth client ID.
 *    Application type: Desktop app. Note client ID and client secret.
 * 2. Set in .env: GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=...
 * 3. Run this script. Open the printed URL in a browser, sign in with the Google account
 *    whose Drive should hold the slides. After allowing, paste the code shown in the browser.
 * 4. Script prints GOOGLE_OAUTH_REFRESH_TOKEN=... — add that to .env.
 * 5. Leave service account vars unset (or remove them) so the app uses OAuth.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { OAuth2Client } = require("google-auth-library");
const readline = require("readline");

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/presentations",
];

async function main() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.error("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env (OAuth Desktop client from GCP Console).");
    process.exit(1);
  }

  const oauth2 = new OAuth2Client(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob");
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("Open this URL in your browser, sign in, then paste the code you get:\n");
  console.log(url);
  console.log("\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const code = await new Promise((resolve) => rl.question("Paste the code from the browser: ", resolve));
  rl.close();

  const { tokens } = await oauth2.getToken(code.trim());
  if (!tokens.refresh_token) {
    console.error("No refresh_token in response. Sign in again and ensure you click through all consent (or revoke app access and try again).");
    process.exit(1);
  }

  console.log("\nAdd this to your .env:\n");
  console.log("GOOGLE_OAUTH_REFRESH_TOKEN=" + tokens.refresh_token);
  console.log("\nThen unset or remove GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_APPLICATION_CREDENTIALS so the app uses OAuth.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
