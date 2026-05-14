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
  private readonly exchange = new BinanceClient(
    env.binanceBaseUrl,
    env.topSymbolsCachePath,
    env.topSymbolsCacheTtlMs,
  );
  private readonly telegram = new TelegramClient(
    env.telegramSendMessageUrl,
    env.telegramBotToken,
    env.telegramChatId,
    env.maxHoldHours,
  );
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
    console.log(`[scanner] scanAndNotify started at ${new Date().toISOString()}`);
    const result = await this.scan();
    const newSignals: StrategySignal[] = [];

    for (const signal of result.signals) {
      const key = `${signal.symbol}:${signal.side}:${signal.h4CloseTime}`;
      if (this.sentSignalKeys.has(key)) continue;
      this.sentSignalKeys.add(key);
      newSignals.push(signal);
    }

    if (newSignals.length > 0) {
      console.log(`[scanner] sending Telegram signal list. signals=${newSignals.length}`);
      await this.telegram.sendSignalList(newSignals);
    }

    console.log(
      `[scanner] scanAndNotify finished. checked=${result.checked}, signals=${result.signals.length}, errors=${result.errors.length}`,
    );
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
      console.log(`[scanner] symbols to scan (${symbols.length}): ${symbols.join(', ')}`);

      for (let index = 0; index < symbols.length; index += env.scanConcurrency) {
        const batch = symbols.slice(index, index + env.scanConcurrency);
        console.log(`[scanner] scanning batch ${index + 1}-${index + batch.length}/${symbols.length}: ${batch.join(', ')}`);
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
      console.log(`[scanner] scanning ${symbol}`);
      const [candles1h, candles2h, candles4h] = await Promise.all([
        this.exchange.getClosedCandles(symbol, '1h', Math.max(env.volLen + env.slLookback1h + 5, 40)),
        this.exchange.getClosedCandles(symbol, '2h', Math.max(env.volLen + 5, 30)),
        this.exchange.getClosedCandles(symbol, '4h', 10),
      ]);

      const signal = evaluateAltFlow(
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

      if (signal) {
        console.log(
          `[scanner] signal found ${signal.side} ${signal.symbol} price=${signal.price} tp=${signal.tp} sl=${signal.sl}`,
        );
      } else {
        console.log(`[scanner] no signal ${symbol}`);
      }

      return signal;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[scanner] error ${symbol}: ${message}`);
      errors.push({ symbol, message });
      return null;
    }
  }
}

export const coinScanner = new CoinScanner();
