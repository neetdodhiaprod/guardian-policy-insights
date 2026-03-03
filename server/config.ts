import dotenv from 'dotenv';

dotenv.config();

type RequiredEnv = {
  MONGODB_URI: string;
  ADMIN_DASHBOARD_KEY: string;
  API_PORT: number;
};

export function getEnv(): RequiredEnv {
  const MONGODB_URI = process.env.MONGODB_URI;
  const ADMIN_DASHBOARD_KEY = process.env.ADMIN_DASHBOARD_KEY;
  const API_PORT = Number(process.env.API_PORT || 3001);

  if (!MONGODB_URI) throw new Error('Missing env: MONGODB_URI');
  if (!ADMIN_DASHBOARD_KEY) throw new Error('Missing env: ADMIN_DASHBOARD_KEY');
  if (!Number.isFinite(API_PORT)) throw new Error('Invalid env: API_PORT');

  return { MONGODB_URI, ADMIN_DASHBOARD_KEY, API_PORT };
}
