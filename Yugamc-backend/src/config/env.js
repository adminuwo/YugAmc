const path = require('path');
const fs = require('fs');

// Attempt to load .env from standard project locations
const potentialEnvPaths = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
];

for (const envPath of potentialEnvPaths) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}
require('dotenv').config();

// Determine runtime environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Mandatory variables required for core system integrity
const mandatoryEnv = [
  'MONGO_URI',
  'JWT_SECRET',
];

// Recommended variables for integrations
const recommendedEnv = [
  'EMAIL_USER',
  'EMAIL_PASS',
  'GCP_PROJECT_ID',
  'GCS_BUCKET_NAME',
  'SUPER_ADMIN_API_KEY',
  'SUPER_ADMIN_WEBHOOK_SECRET',
  'ADMIN_PASSWORD_HASH',
];

const missingMandatory = mandatoryEnv.filter((key) => !process.env[key]);
if (missingMandatory.length > 0) {
  const errMsg = `[Config Warning]: Missing mandatory environment variables: ${missingMandatory.join(', ')}. Please configure them in your .env file or environment settings.`;
  if (isProduction) {
    console.error(`[CRITICAL ERROR]: ${errMsg}`);
  } else {
    console.warn(errMsg);
  }
}

const missingRecommended = recommendedEnv.filter((key) => !process.env[key] && !process.env.ADMIN_PASSWORD);
if (missingRecommended.length > 0 && !isProduction) {
  console.info(`[Config Info]: Unset optional integration variables: ${missingRecommended.join(', ')}`);
}

module.exports = {
  NODE_ENV,
  PORT: Number(process.env.PORT) || 8080,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  SUPER_ADMIN_API_KEY: process.env.SUPER_ADMIN_API_KEY,
  SUPER_ADMIN_WEBHOOK_URL: process.env.SUPER_ADMIN_WEBHOOK_URL,
  SUPER_ADMIN_PLATFORM_ID: process.env.SUPER_ADMIN_PLATFORM_ID || 'yugamc-id',
  SUPER_ADMIN_WEBHOOK_SECRET: process.env.SUPER_ADMIN_WEBHOOK_SECRET,
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID,
  GOOGLE_LOCATION: process.env.GOOGLE_LOCATION || 'asia-south1',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME,
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((o) => o.trim()),
};

