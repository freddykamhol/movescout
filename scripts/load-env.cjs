/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

function loadIfExists(fileName) {
  const fullPath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(fullPath)) return false;
  dotenv.config({ path: fullPath, override: false });
  return true;
}

// Load order (first match wins):
// 1) .env.local (developer machine)
// 2) .env (fallback)
// 3) process.env (already set by host)
loadIfExists(".env.local");
loadIfExists(".env");
