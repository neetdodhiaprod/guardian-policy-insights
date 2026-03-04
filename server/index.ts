import express from 'express';
import cors from 'cors';
import { getEnv } from './config';
import { adminRouter } from './routes/admin';
import { analyzeRouter } from './routes/analyze';
import { featuresRouter } from './routes/features';
import { requireAdmin } from './middleware/adminAuth';

const { API_PORT } = getEnv();

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/admin', requireAdmin, adminRouter);
app.use('/api', analyzeRouter);
app.use('/api', featuresRouter);

app.listen(API_PORT, () => {
  console.log(`[api] listening on http://localhost:${API_PORT}`);
});
