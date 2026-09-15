import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

let projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;

if (!projectId) {
  try {
    // Attempt to read from the config file if available in the local environment
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      projectId = config.projectId;
    }
  } catch (e) {
    console.warn("Could not read firebase-applet-config.json, falling back to default ADC");
  }
}

if (!getApps().length) {
  if (projectId) {
    initializeApp({ projectId });
  } else {
    initializeApp(); // Falls back to Application Default Credentials
  }
}

export const adminAuth = getAuth();
