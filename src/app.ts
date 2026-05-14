import express from 'express';
import { env } from './config/env';
import { coinScanner } from './scanner/coinScanner';

const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    name: 'alt-flow-coin-scanner',
    version: env.version,
    cronEnabled: env.cronEnabled,
    cronExpression: env.cronExpression,
    timezone: env.timezone,
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.post('/scan', async (_req, res) => {
  const result = await coinScanner.scanAndNotify();
  res.json(result);
});

app.get('/api/cron', async (_req, res) => {
  const result = await coinScanner.scanAndNotify();
  res.json(result);
});

app.get('/api/cron/vercel', async (_req, res) => {
  const result = await coinScanner.scanAndNotify();
  res.json(result);
});

export default app;
