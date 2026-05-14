import cron from 'node-cron';
import { env } from '../config/env';
import { BinanceClient } from '../exchange/binanceClient';
import { evaluateAltFlow } from '../strategy/altFlowStrategy';
import { StrategySignal } from '../strategy/types';
import { TelegramClient } from '../telegram/telegramClient';

interface ScanResult {
  checked: number;
  signals: StrategySignal[];
  errors: Array<{ symbol: string; message: string }>;
}

export class CoinScanner {
  private readonly exchange = new BinanceClient(env.binanceBaseUrl);
  private readonly telegram = new TelegramClient(env.telegramSendMessageUrl, env.telegramBotToken, env.telegramChatId);
  private readonly sentSignalKeys = new Set<string>();
  private running = false;

  startCron(): void {
    if (!env.cronEnabled) {
      console.log('Cron scanner is disabled.');
      return;
    }

    cron.schedule(
      env.cronExpression,
      async () => {
        await this.scanAndNotify();
      },
      { timezone: env.timezone },
    );

    console.log(`Cron scanner scheduled: "${env.cronExpression}" (${env.timezone})`);
  }

  async scanAndNotify(): Promise<ScanResult> {
    const result = await this.scan();

    for (const signal of result.signals) {
      const key = `${signal.symbol}:${signal.side}:${signal.h4CloseTime}`;
      if (this.sentSignalKeys.has(key)) continue;
      this.sentSignalKeys.add(key);
      await this.telegram.sendSignal(signal);
    }

    return result;
  }

  async scan(): Promise<ScanResult> {
    if (this.running) {
      return { checked: 0, signals: [], errors: [{ symbol: 'scanner', message: 'Scan is already running' }] };
    }

    this.running = true;
    const signals: StrategySignal[] = [];
    const errors: Array<{ symbol: string; message: string }> = [];

    try {
      const symbols = env.scanSymbols.length > 0 ? env.scanSymbols : await this.exchange.getTopUsdtSymbols(env.maxSymbols);

      for (let index = 0; index < symbols.length; index += env.scanConcurrency) {
        const batch = symbols.slice(index, index + env.scanConcurrency);
        const batchSignals = await Promise.all(batch.map((symbol) => this.scanSymbol(symbol, errors)));
        signals.push(...batchSignals.filter((signal): signal is StrategySignal => Boolean(signal)));
      }

      console.log(`Scan completed. Checked=${symbols.length}, signals=${signals.length}, errors=${errors.length}`);
      return { checked: symbols.length, signals, errors };
    } finally {
      this.running = false;
    }
  }

  private async scanSymbol(
    symbol: string,
    errors: Array<{ symbol: string; message: string }>,
  ): Promise<StrategySignal | null> {
    try {
      const [candles1h, candles2h, candles4h] = await Promise.all([
        this.exchange.getClosedCandles(symbol, '1h', Math.max(env.volLen + env.slLookback1h + 5, 40)),
        this.exchange.getClosedCandles(symbol, '2h', Math.max(env.volLen + 5, 30)),
        this.exchange.getClosedCandles(symbol, '4h', 10),
      ]);

      return evaluateAltFlow(
        { symbol, candles1h, candles2h, candles4h },
        {
          volLen: env.volLen,
          volMultAvg: env.volMultAvg,
          volMultPrev: env.volMultPrev,
          volMode: env.volMode,
          needCloseConfirm: env.needCloseConfirm,
          slLookback1h: env.slLookback1h,
          rewardRisk: env.rewardRisk,
        },
      );
    } catch (error) {
      errors.push({ symbol, message: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
}

export const coinScanner = new CoinScanner();
