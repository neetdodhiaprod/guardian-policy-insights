import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

type Env = {
  MONGODB_URI: string | undefined;
  ADMIN_DASHBOARD_KEY: string | undefined;
  API_PORT: number;
};

export function getEnv(): Env {
  const API_PORT = Number(process.env.API_PORT || 3001);
  if (!Number.isFinite(API_PORT)) throw new Error('Invalid env: API_PORT');

  return {
    MONGODB_URI: process.env.MONGODB_URI,
    ADMIN_DASHBOARD_KEY: process.env.ADMIN_DASHBOARD_KEY,
    API_PORT,
  };
}
