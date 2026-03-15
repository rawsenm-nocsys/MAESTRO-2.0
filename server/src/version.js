import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

const rootPackagePath = path.join(__dirname, '..', '..', 'package.json');
const rootPkg = safeReadJson(rootPackagePath);

const APP_VERSION = process.env.MAESTRO_VERSION || rootPkg?.version || 'unknown';
const APP_GIT_SHA = process.env.MAESTRO_GIT_SHA || 'unknown';
const APP_BUILD_TIME = process.env.MAESTRO_BUILD_TIME || 'unknown';

export function getVersionInfo() {
  return {
    version: APP_VERSION,
    gitSha: APP_GIT_SHA,
    buildTime: APP_BUILD_TIME,
  };
}