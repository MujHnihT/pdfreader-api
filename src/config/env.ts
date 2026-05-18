import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  return ['true', '1', 'yes', 'y'].includes(value.toLowerCase());
};

const toList = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
};

export const env = {
  port: toNumber(process.env.PORT, 3000),
  version: process.env.VERSION || '1.0.0',
  cronEnabled: toBoolean(process.env.CRON_ENABLED, true),
  cronExpression: process.env.CRON_EXPRESSION || '5 * * * *',
  priceJumpCronEnabled: toBoolean(process.env.PRICE_JUMP_CRON_ENABLED, true),
  priceJumpCronExpression: process.env.PRICE_JUMP_CRON_EXPRESSION || '0 * * * *',
  timezone: process.env.TZ || process.env.TIMEZONE || 'Asia/Ho_Chi_Minh',
  maxSymbols: toNumber(process.env.MAX_SYMBOLS, 50),
  scanConcurrency: toNumber(process.env.SCAN_CONCURRENCY, 5),
  scanSymbols: toList(process.env.SCAN_SYMBOLS),
  topSymbolsCachePath: process.env.TOP_SYMBOLS_CACHE_PATH || '.cache/top-usdt-symbols.json',
  topSymbolsCacheTtlMs: toNumber(process.env.TOP_SYMBOLS_CACHE_TTL_MS, 60 * 60 * 1000),
  activeSignalsCachePath: process.env.ACTIVE_SIGNALS_CACHE_PATH || '.cache/active-signals.json',
  telegramSendMessageUrl: process.env.TELEGRAM_SEND_MESSAGE_URL || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  binanceBaseUrl: process.env.BINANCE_BASE_URL || 'https://fapi.binance.com',
  volLen: toNumber(process.env.VOL_LEN, 20),
  volMultAvg: toNumber(process.env.VOL_MULT_AVG, 1.2),
  volMultPrev: toNumber(process.env.VOL_MULT_PREV, 1.0),
  volMode: (process.env.VOL_MODE === 'OR' ? 'OR' : 'AND') as 'OR' | 'AND',
  needCloseConfirm: toBoolean(process.env.NEED_CLOSE_CONFIRM, false),
  slLookback1h: toNumber(process.env.SL_LOOKBACK_1H, 8),
  rewardRisk: toNumber(process.env.REWARD_RISK, 1.2),
  maxHoldHours: toNumber(process.env.MAX_HOLD_HOURS, 0),
  priceJumpTopSymbols: toNumber(process.env.PRICE_JUMP_TOP_SYMBOLS, 20),
  priceJumpLookbackMinutes: toNumber(process.env.PRICE_JUMP_LOOKBACK_MINUTES, 60),
  priceJumpInterval: process.env.PRICE_JUMP_INTERVAL || '1m',
};
