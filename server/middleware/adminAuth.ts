import type { Request, Response, NextFunction } from 'express';
import { getEnv } from '../config';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const { ADMIN_DASHBOARD_KEY } = getEnv();
  const key = req.header('x-admin-key');
  if (!key || key !== ADMIN_DASHBOARD_KEY) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  return next();
}
