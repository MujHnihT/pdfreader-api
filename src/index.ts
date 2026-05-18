import app from './app';
import { env } from './config/env';
import { coinScanner } from './scanner/coinScanner';
import { priceJumpScanner } from './scanner/priceJumpScanner';

if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`Server is running on port ${env.port}`);
    coinScanner.startCron();
    priceJumpScanner.startCron();
  });
}

export default app;
