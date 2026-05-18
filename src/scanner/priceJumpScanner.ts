import cron from 'node-cron';
import { env } from '../config/env';
import { BinanceClient } from '../exchange/binanceClient';
import { Candle } from '../strategy/types';
import { PriceJumpSummary, TelegramClient } from '../telegram/telegramClient';

interface PriceJumpResult {
  checked: number;
  summaries: PriceJumpSummary[];
  errors: Array<{ symbol: string; message: string }>;
}

export class PriceJumpScanner {
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
  private running = false;

  startCron(): void {
    if (!env.priceJumpCronEnabled) {
      console.log('Price jump cron is disabled.');
      return;
    }

    cron.schedule(
      env.priceJumpCronExpression,
      async () => {
        await this.scanAndNotify();
      },
      { timezone: env.timezone },
    );

    console.log(`Price jump cron scheduled: "${env.priceJumpCronExpression}" (${env.timezone})`);
  }

  async scanAndNotify(): Promise<PriceJumpResult> {
    console.log(`[price-jump] scanAndNotify started at ${new Date().toISOString()}`);
    const result = await this.scan();

    if (result.summaries.length > 0) {
      console.log(`[price-jump] sending Telegram report. rows=${result.summaries.length}`);
      await this.telegram.sendPriceJumpReport(result.summaries, env.priceJumpLookbackMinutes);
    }

    console.log(
      `[price-jump] scanAndNotify finished. checked=${result.checked}, rows=${result.summaries.length}, errors=${result.errors.length}`,
    );
    return result;
  }

  async scan(): Promise<PriceJumpResult> {
    if (this.running) {
      return { checked: 0, summaries: [], errors: [{ symbol: 'price-jump', message: 'Scan is already running' }] };
    }

    this.running = true;
    const summaries: PriceJumpSummary[] = [];
    const errors: Array<{ symbol: string; message: string }> = [];

    try {
      const topLimit = Math.max(1, env.priceJumpTopSymbols);
      const symbols = env.scanSymbols.length > 0 ? env.scanSymbols.slice(0, topLimit) : await this.exchange.getTopUsdtSymbols(topLimit);
      console.log(`[price-jump] symbols to scan (${symbols.length}): ${symbols.join(', ')}`);

      for (let index = 0; index < symbols.length; index += env.scanConcurrency) {
        const batch = symbols.slice(index, index + env.scanConcurrency);
        const batchSummaries = await Promise.all(batch.map((symbol) => this.scanSymbol(symbol, errors)));
        summaries.push(
          ...batchSummaries.filter((summary): summary is PriceJumpSummary => Boolean(summary)),
        );
      }

      summaries.sort((a, b) => b.jumps - a.jumps || b.rangePercent - a.rangePercent);
      return { checked: symbols.length, summaries, errors };
    } finally {
      this.running = false;
    }
  }

  private async scanSymbol(
    symbol: string,
    errors: Array<{ symbol: string; message: string }>,
  ): Promise<PriceJumpSummary | null> {
    try {
      const limit = Math.max(2, env.priceJumpLookbackMinutes + 1);
      const candles = await this.exchange.getClosedCandles(symbol, env.priceJumpInterval, limit);
      const windowCandles = candles.slice(-limit);
      if (windowCandles.length < 2) {
        throw new Error(`Not enough candles for ${env.priceJumpInterval}: ${windowCandles.length}`);
      }

      const summary = this.summarize(symbol, windowCandles);
      console.log(
        `[price-jump] ${symbol} jumps=${summary.jumps} up=${summary.upJumps} down=${summary.downJumps} change=${summary.changePercent.toFixed(2)}%`,
      );
      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[price-jump] error ${symbol}: ${message}`);
      errors.push({ symbol, message });
      return null;
    }
  }

  private summarize(symbol: string, candles: Candle[]): PriceJumpSummary {
    let jumps = 0;
    let upJumps = 0;
    let downJumps = 0;
    let unchanged = 0;

    for (let index = 1; index < candles.length; index += 1) {
      const previous = candles[index - 1].close;
      const current = candles[index].close;
      if (current > previous) {
        jumps += 1;
        upJumps += 1;
      } else if (current < previous) {
        jumps += 1;
        downJumps += 1;
      } else {
        unchanged += 1;
      }
    }

    const first = candles[0];
    const last = candles[candles.length - 1];
    const high = Math.max(...candles.map((candle) => candle.high));
    const low = Math.min(...candles.map((candle) => candle.low));

    return {
      symbol,
      jumps,
      upJumps,
      downJumps,
      unchanged,
      open: first.open,
      close: last.close,
      high,
      low,
      changePercent: ((last.close - first.open) / first.open) * 100,
      rangePercent: ((high - low) / first.open) * 100,
      fromTime: first.openTime,
      toTime: last.closeTime,
    };
  }
}

export const priceJumpScanner = new PriceJumpScanner();
