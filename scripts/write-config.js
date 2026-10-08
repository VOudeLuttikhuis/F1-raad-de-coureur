// Writes public/config.js from environment variables (Netlify build) or .env.local (local dev).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envFile = path.join(root, ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const config = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  databaseURL: process.env.FIREBASE_DATABASE_URL || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
};
if (!config.apiKey || !config.databaseURL) {
  console.warn("FIREBASE_API_KEY or FIREBASE_DATABASE_URL missing: multiplayer and top 10 are disabled.");
}

fs.writeFileSync(path.join(root, "public", "config.js"), `window.F1Q_CONFIG = ${JSON.stringify(config)};\n`);
