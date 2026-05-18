import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';
import { BinanceClient } from '../exchange/binanceClient';
import { evaluateAltFlow } from '../strategy/altFlowStrategy';
import { Candle, StrategySignal } from '../strategy/types';
import { ExitNotification, TelegramClient } from '../telegram/telegramClient';

interface ScanResult {
  checked: number;
  signals: StrategySignal[];
  exits: ExitNotification[];
  errors: Array<{ symbol: string; message: string }>;
}

interface SymbolScan {
  symbol: string;
  signal: StrategySignal | null;
  latestH4: Candle | null;
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
  private readonly activeSignals = new Map<string, StrategySignal>();
  private activeSignalsLoaded = false;
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
    await this.loadActiveSignals();
    let result: ScanResult | null = null;
    let newSignalsCount = 0;

    try {
      result = await this.scan();
      const newSignals: StrategySignal[] = [];

      if (result.exits.length > 0) {
        console.log(`[scanner] sending Telegram exit list. exits=${result.exits.length}`);
        await this.telegram.sendExitList(result.exits);
      }

      for (const signal of result.signals) {
        const key = `${signal.symbol}:${signal.side}:${signal.h4CloseTime}`;
        if (this.sentSignalKeys.has(key)) continue;
        this.sentSignalKeys.add(key);
        newSignals.push(signal);
      }

      newSignalsCount = newSignals.length;
      if (newSignals.length > 0) {
        console.log(`[scanner] sending Telegram signal list. signals=${newSignals.length}`);
        await this.telegram.sendSignalList(newSignals);
        for (const signal of newSignals) {
          this.activeSignals.set(signal.symbol, signal);
        }
        await this.saveActiveSignals();
      }

      console.log('[scanner] sending Telegram scan summary.');
      await this.telegram.sendScanSummaryReport({
        checked: result.checked,
        signals: result.signals.length,
        newSignals: newSignalsCount,
        exits: result.exits.length,
        errors: result.errors.length,
      });

      console.log(
        `[scanner] scanAndNotify finished. checked=${result.checked}, signals=${result.signals.length}, exits=${result.exits.length}, errors=${result.errors.length}`,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[scanner] scanAndNotify failed: ${message}`);
      await this.telegram.sendScanFailureReport(message);
      throw error;
    }
  }

  async scan(): Promise<ScanResult> {
    if (this.running) {
      return { checked: 0, signals: [], exits: [], errors: [{ symbol: 'scanner', message: 'Scan is already running' }] };
    }

    this.running = true;
    const signals: StrategySignal[] = [];
    const scans: SymbolScan[] = [];
    const errors: Array<{ symbol: string; message: string }> = [];

    try {
      const symbols = env.scanSymbols.length > 0 ? env.scanSymbols : await this.exchange.getTopUsdtSymbols(env.maxSymbols);
      console.log(`[scanner] symbols to scan (${symbols.length}): ${symbols.join(', ')}`);

      for (let index = 0; index < symbols.length; index += env.scanConcurrency) {
        const batch = symbols.slice(index, index + env.scanConcurrency);
        console.log(`[scanner] scanning batch ${index + 1}-${index + batch.length}/${symbols.length}: ${batch.join(', ')}`);
        const batchScans = await Promise.all(batch.map((symbol) => this.scanSymbol(symbol, errors)));
        scans.push(...batchScans);
        signals.push(...batchScans.map((scan) => scan.signal).filter((signal): signal is StrategySignal => Boolean(signal)));
      }

      const exits = await this.findExitNotifications(scans);
      console.log(`Scan completed. Checked=${symbols.length}, signals=${signals.length}, exits=${exits.length}, errors=${errors.length}`);
      return { checked: symbols.length, signals, exits, errors };
    } finally {
      this.running = false;
    }
  }

  private async scanSymbol(
    symbol: string,
    errors: Array<{ symbol: string; message: string }>,
  ): Promise<SymbolScan> {
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
      const pricedSignal = signal ? await this.withCurrentEntry(signal) : null;

      if (pricedSignal) {
        console.log(
          `[scanner] signal found ${pricedSignal.side} ${pricedSignal.symbol} price=${pricedSignal.price} tp=${pricedSignal.tp} sl=${pricedSignal.sl}`,
        );
      } else {
        console.log(`[scanner] no signal ${symbol}`);
      }

      return { symbol, signal: pricedSignal, latestH4: candles4h[candles4h.length - 1] || null };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[scanner] error ${symbol}: ${message}`);
      errors.push({ symbol, message });
      return { symbol, signal: null, latestH4: null };
    }
  }

  private async findExitNotifications(scans: SymbolScan[]): Promise<ExitNotification[]> {
    const exits: ExitNotification[] = [];
    const scanBySymbol = new Map(scans.map((scan) => [scan.symbol, scan]));

    for (const [symbol, activeSignal] of this.activeSignals.entries()) {
      const scan = scanBySymbol.get(symbol);
      if (!scan?.latestH4) continue;

      const exit = this.getExitNotification(activeSignal, scan);
      if (!exit) continue;

      exits.push(exit);
      this.activeSignals.delete(symbol);
    }

    if (exits.length > 0) {
      await this.saveActiveSignals();
    }

    return exits;
  }

  private async withCurrentEntry(signal: StrategySignal): Promise<StrategySignal | null> {
    const price = await this.exchange.getCurrentPrice(signal.symbol);
    const risk = signal.side === 'BUY' ? price - signal.sl : signal.sl - price;

    if (risk <= 0) {
      console.warn(
        `[scanner] ignored ${signal.side} ${signal.symbol}: current price=${price} is past SL=${signal.sl}`,
      );
      return null;
    }

    return {
      ...signal,
      price,
      tp: signal.side === 'BUY' ? price + risk * env.rewardRisk : price - risk * env.rewardRisk,
    };
  }

  private getExitNotification(activeSignal: StrategySignal, scan: SymbolScan): ExitNotification | null {
    const oppositeSide = activeSignal.side === 'BUY' ? 'SELL' : 'BUY';
    if (scan.signal?.side === oppositeSide) {
      return {
        signal: activeSignal,
        exitPrice: scan.signal.price,
        reason: `opposite ${oppositeSide} signal`,
        checkedAt: Date.now(),
      };
    }

    const latestH4 = scan.latestH4;
    if (!latestH4 || latestH4.closeTime <= activeSignal.h4CloseTime) return null;

    const h4AgainstBuy = activeSignal.side === 'BUY' && latestH4.close < latestH4.open;
    const h4AgainstSell = activeSignal.side === 'SELL' && latestH4.close > latestH4.open;
    if (!h4AgainstBuy && !h4AgainstSell) return null;

    return {
      signal: activeSignal,
      exitPrice: latestH4.close,
      reason: activeSignal.side === 'BUY' ? 'H4 turned red' : 'H4 turned green',
      checkedAt: Date.now(),
    };
  }

  private async loadActiveSignals(): Promise<void> {
    if (this.activeSignalsLoaded) return;
    this.activeSignalsLoaded = true;

    try {
      const raw = await fs.readFile(env.activeSignalsCachePath, 'utf8');
      const signals = JSON.parse(raw) as StrategySignal[];
      if (!Array.isArray(signals)) return;

      this.activeSignals.clear();
      for (const signal of signals) {
        if (signal?.symbol && signal?.side) {
          this.activeSignals.set(signal.symbol, signal);
          this.sentSignalKeys.add(`${signal.symbol}:${signal.side}:${signal.h4CloseTime}`);
        }
      }

      console.log(`[scanner] active signals loaded. count=${this.activeSignals.size}`);
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code !== 'ENOENT') {
        console.warn(`[scanner] could not load active signals: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async saveActiveSignals(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(env.activeSignalsCachePath), { recursive: true });
      const signals = Array.from(this.activeSignals.values());
      await fs.writeFile(env.activeSignalsCachePath, `${JSON.stringify(signals, null, 2)}\n`, 'utf8');
    } catch (error) {
      console.warn(`[scanner] could not save active signals: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const coinScanner = new CoinScanner();
