import app from './app';
import { env } from './config/env';
import { coinScanner } from './scanner/coinScanner';

if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`Server is running on port ${env.port}`);
    coinScanner.startCron();
  });
}

export default app;
