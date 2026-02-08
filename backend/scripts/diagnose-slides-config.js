/**
 * Diagnostic script to check Google Slides API configuration.
 * Run: node scripts/diagnose-slides-config.js
 * 
 * This script checks:
 * 1. Service account credentials are present and valid
 * 2. Scopes requested match what's needed
 * 3. Provides specific GCP Console links to enable APIs
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { getSlidesAuth } = require("../src/services/slidesService");
const {
  GOOGLE_APPLICATION_CREDENTIALS,
  GOOGLE_SERVICE_ACCOUNT_JSON,
} = require("../src/config/env");
const fs = require("fs");
const path = require("path");

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/presentations",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive",
];

const REQUIRED_APIS = [
  { name: "Google Slides API", id: "slides.googleapis.com" },
  { name: "Google Drive API", id: "drive.googleapis.com" },
];

function getServiceAccountInfo() {
  let credentials = null;
  
  if (GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      credentials = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
    } catch (e) {
      return { error: `GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON: ${e.message}` };
    }
  } else if (GOOGLE_APPLICATION_CREDENTIALS) {
    const keyPath = path.isAbsolute(GOOGLE_APPLICATION_CREDENTIALS)
      ? GOOGLE_APPLICATION_CREDENTIALS
      : path.resolve(process.cwd(), GOOGLE_APPLICATION_CREDENTIALS);
    
    if (!fs.existsSync(keyPath)) {
      return { error: `Service account file not found: ${keyPath}` };
    }
    
    try {
      const content = fs.readFileSync(keyPath, "utf8");
      credentials = JSON.parse(content);
    } catch (e) {
      return { error: `Failed to read service account file: ${e.message}` };
    }
  } else {
    return { error: "No service account credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON" };
  }

  if (!credentials || credentials.type !== "service_account") {
    return { error: "Invalid service account credentials: missing or wrong type" };
  }

  return {
    project_id: credentials.project_id,
    client_email: credentials.client_email,
    private_key_id: credentials.private_key_id,
    credentials,
  };
}

function getGcpConsoleLinks(projectId) {
  const baseUrl = `https://console.cloud.google.com`;
  return {
    project: `${baseUrl}/home/dashboard?project=${projectId}`,
    apis: `${baseUrl}/apis/library?project=${projectId}`,
    slidesApi: `${baseUrl}/apis/library/slides.googleapis.com?project=${projectId}`,
    driveApi: `${baseUrl}/apis/library/drive.googleapis.com?project=${projectId}`,
    serviceAccounts: `${baseUrl}/iam-admin/serviceaccounts?project=${projectId}`,
    apiCredentials: `${baseUrl}/apis/credentials?project=${projectId}`,
  };
}

async function testAuth() {
  try {
    const auth = getSlidesAuth();
    const client = await auth.getClient();
    const projectId = await auth.getProjectId();
    const credentials = await auth.getCredentials();
    
    return {
      success: true,
      projectId,
      clientEmail: credentials.client_email || "N/A",
      scopes: client.scopes || [],
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

async function testSlidesApi() {
  const { google } = require("googleapis");
  try {
    const auth = getSlidesAuth();
    const slidesApi = google.slides({ version: "v1", auth });
    
    // Try to create a test presentation
    const res = await slidesApi.presentations.create({
      requestBody: { title: "GitHunter Diagnostic Test" },
    });
    
    const presentationId = res.data?.presentationId;
    
    // Clean up immediately
    if (presentationId) {
      const drive = google.drive({ version: "v3", auth });
      await drive.files.delete({ fileId: presentationId }).catch(() => {});
    }
    
    return {
      success: true,
      presentationId,
      message: "Successfully created and deleted test presentation",
    };
  } catch (error) {
    const code = error.code ?? error.response?.status;
    const message = error.message || error.cause?.message || String(error);
    // Capture full Google API error body (explains WHY 403)
    const responseData = error.response?.data;
    const responseStatus = error.response?.status;

    return {
      success: false,
      code,
      message,
      responseStatus,
      responseData,
      isPermissionError: code === 403 || /permission|PERMISSION_DENIED/i.test(message),
    };
  }
}

async function main() {
  console.log("=".repeat(80));
  console.log("Google Slides API Configuration Diagnostic");
  console.log("=".repeat(80));
  console.log();

  // Step 1: Check credentials
  console.log("1. Checking Service Account Credentials...");
  const saInfo = getServiceAccountInfo();
  
  if (saInfo.error) {
    console.log(`   ❌ ERROR: ${saInfo.error}`);
    console.log();
    console.log("   To fix:");
    console.log("   - Create a service account in GCP Console");
    console.log("   - Download the JSON key file");
    console.log("   - Set GOOGLE_APPLICATION_CREDENTIALS=./path/to/key.json in .env");
    console.log("   - OR set GOOGLE_SERVICE_ACCOUNT_JSON='{...}' with the JSON content");
    process.exit(1);
  }

  console.log(`   ✓ Project ID: ${saInfo.project_id}`);
  console.log(`   ✓ Service Account: ${saInfo.client_email}`);
  console.log(`   ✓ Key ID: ${saInfo.private_key_id}`);
  console.log();

  // Step 2: Test authentication
  console.log("2. Testing Authentication...");
  const authTest = await testAuth();
  
  if (!authTest.success) {
    console.log(`   ❌ Authentication failed: ${authTest.error}`);
    console.log();
    process.exit(1);
  }

  console.log(`   ✓ Authenticated as: ${authTest.clientEmail}`);
  console.log(`   ✓ Project ID: ${authTest.projectId}`);
  console.log(`   ✓ Scopes requested: ${authTest.scopes.length > 0 ? authTest.scopes.join(", ") : "default"}`);
  console.log();

  // Step 3: Check scopes
  console.log("3. Checking Required Scopes...");
  const requestedScopes = authTest.scopes || [];
  const missingScopes = REQUIRED_SCOPES.filter(scope => !requestedScopes.includes(scope));
  
  if (missingScopes.length > 0) {
    console.log(`   ⚠️  Missing scopes (may use defaults):`);
    missingScopes.forEach(scope => console.log(`      - ${scope}`));
  } else {
    console.log(`   ✓ All required scopes are present`);
  }
  console.log();

  // Step 4: Test Slides API
  console.log("4. Testing Google Slides API...");
  const apiTest = await testSlidesApi();
  
  if (apiTest.success) {
    console.log(`   ✓ ${apiTest.message}`);
    console.log();
    console.log("=".repeat(80));
    console.log("✅ All checks passed! Your configuration is correct.");
    console.log("=".repeat(80));
    return;
  }

  console.log(`   ❌ API call failed`);
  console.log(`   Status Code: ${apiTest.code ?? apiTest.responseStatus ?? "N/A"}`);
  console.log(`   Error: ${apiTest.message}`);
  if (apiTest.responseData) {
    console.log();
    console.log("   Raw Google API error (this explains the exact reason):");
    console.log(JSON.stringify(apiTest.responseData, null, 2).split("\n").map((l) => "   " + l).join("\n"));
  }
  console.log();

  if (apiTest.isPermissionError) {
    console.log("=".repeat(80));
    console.log("🔧 CONFIGURATION REQUIRED IN GCP CONSOLE");
    console.log("=".repeat(80));
    console.log();
    console.log("The service account exists but the APIs are not enabled.");
    console.log();
    console.log(`Project: ${saInfo.project_id}`);
    console.log(`Service Account: ${saInfo.client_email}`);
    console.log();
    
    const links = getGcpConsoleLinks(saInfo.project_id);
    
    console.log("REQUIRED ACTIONS:");
    console.log();
    
    REQUIRED_APIS.forEach((api, index) => {
      console.log(`${index + 1}. Enable ${api.name}:`);
      console.log(`   Direct link: ${links[api.id === "slides.googleapis.com" ? "slidesApi" : "driveApi"]}`);
      console.log(`   Or navigate: APIs & Services → Library → search "${api.name}" → Enable`);
      console.log();
    });
    
    console.log("ALTERNATIVE: Enable via gcloud CLI:");
    console.log(`   gcloud services enable slides.googleapis.com --project=${saInfo.project_id}`);
    console.log(`   gcloud services enable drive.googleapis.com --project=${saInfo.project_id}`);
    console.log();
    
    console.log("After enabling, wait 1-2 minutes for propagation, then run this diagnostic again.");
    console.log();
    console.log("Useful GCP Console Links:");
    console.log(`   Project Dashboard: ${links.project}`);
    console.log(`   APIs & Services: ${links.apis}`);
    console.log(`   Service Accounts: ${links.serviceAccounts}`);
    console.log();
  } else {
    console.log("=".repeat(80));
    console.log("❌ UNEXPECTED ERROR");
    console.log("=".repeat(80));
    console.log();
    console.log("This is not a permission error. Check:");
    console.log("1. Your internet connection");
    console.log("2. Service account key is valid and not expired");
    console.log("3. GCP project is active and billing is enabled (if required)");
    console.log();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { main, getServiceAccountInfo, testAuth, testSlidesApi };
