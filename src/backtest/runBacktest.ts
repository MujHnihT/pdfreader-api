import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env';
import { BinanceClient } from '../exchange/binanceClient';
import { evaluateAltFlow } from '../strategy/altFlowStrategy';
import { Candle, StrategySignal } from '../strategy/types';

interface BacktestTrade {
  symbol: string;
  side: StrategySignal['side'];
  entry: number;
  tp: number;
  sl: number;
  signalTime: number;
  scanTime: number;
  result: 'TP' | 'SL' | 'OPEN';
  exit: number;
  exitTime: number;
  r: number;
  ambiguous?: boolean;
}

interface StrategyParams {
  slLookback1h: number;
  rewardRisk: number;
  maxHoldHours?: number;
}

interface SymbolCandles {
  symbol: string;
  candles15m: Candle[];
  candles1h: Candle[];
  candles2h: Candle[];
  candles4h: Candle[];
}

interface BacktestCandleCache {
  symbol: string;
  interval: string;
  coverageStartTime: number;
  coverageEndTime: number;
  candles: Candle[];
}

type TradeOutcome = Pick<BacktestTrade, 'result' | 'exit' | 'exitTime' | 'r' | 'ambiguous'>;

const scanIntervalMs = 15 * 60 * 1000;

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const formatDate = (value: number): string =>
  `${new Date(value).toISOString().replace('T', ' ').slice(0, 16)} UTC`;

const formatPct = (value: number): string => `${(value * 100).toFixed(2)}%`;

const parseNumberList = (value: string | undefined, fallback: number[]): number[] => {
  if (!value) return fallback;
  const numbers = value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  return numbers.length > 0 ? numbers : fallback;
};

const getBacktestCacheDir = (): string => process.env.BACKTEST_CANDLE_CACHE_DIR || '.cache/backtest-candles';

const getCandleCachePath = (symbol: string, interval: string): string => {
  const fileName = `${symbol.toUpperCase()}-${interval}.json`;
  return path.join(getBacktestCacheDir(), fileName);
};

const mergeCandles = (candles: Candle[]): Candle[] => {
  const byOpenTime = new Map<number, Candle>();
  for (const candle of candles) {
    byOpenTime.set(candle.openTime, candle);
  }
  return Array.from(byOpenTime.values()).sort((left, right) => left.openTime - right.openTime);
};

const readCandleCache = async (symbol: string, interval: string): Promise<BacktestCandleCache | null> => {
  try {
    const raw = await fs.readFile(getCandleCachePath(symbol, interval), 'utf8');
    const cache = JSON.parse(raw) as BacktestCandleCache;
    if (
      cache.symbol === symbol &&
      cache.interval === interval &&
      Number.isFinite(cache.coverageStartTime) &&
      Number.isFinite(cache.coverageEndTime) &&
      Array.isArray(cache.candles)
    ) {
      return { ...cache, candles: mergeCandles(cache.candles) };
    }
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code !== 'ENOENT') {
      console.warn(`[backtest] ignored candle cache ${symbol} ${interval}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return null;
};

const writeCandleCache = async (cache: BacktestCandleCache): Promise<void> => {
  await fs.mkdir(getBacktestCacheDir(), { recursive: true });
  await fs.writeFile(getCandleCachePath(cache.symbol, cache.interval), `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
};

const getCachedCandlesInRange = async (
  exchange: BinanceClient,
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
): Promise<Candle[]> => {
  const cached = await readCandleCache(symbol, interval);
  let coverageStartTime = cached?.coverageStartTime ?? Number.POSITIVE_INFINITY;
  let coverageEndTime = cached?.coverageEndTime ?? Number.NEGATIVE_INFINITY;
  let candles = cached?.candles ?? [];
  let cacheChanged = false;

  if (coverageStartTime > startTime) {
    const missingEnd = Math.min(coverageStartTime - 1, endTime);
    if (startTime < missingEnd) {
      console.log(`[backtest] fetching ${symbol} ${interval} left range ${formatDate(startTime)} -> ${formatDate(missingEnd)}`);
      candles = mergeCandles([...candles, ...(await exchange.getCandlesInRange(symbol, interval, startTime, missingEnd))]);
    }
    coverageStartTime = startTime;
    cacheChanged = true;
  }

  if (coverageEndTime < endTime) {
    const missingStart = Math.max(coverageEndTime + 1, startTime);
    if (missingStart < endTime) {
      console.log(`[backtest] fetching ${symbol} ${interval} right range ${formatDate(missingStart)} -> ${formatDate(endTime)}`);
      candles = mergeCandles([...candles, ...(await exchange.getCandlesInRange(symbol, interval, missingStart, endTime))]);
    }
    coverageEndTime = endTime;
    cacheChanged = true;
  }

  if (cacheChanged) {
    await writeCandleCache({ symbol, interval, coverageStartTime, coverageEndTime, candles });
  } else {
    console.log(`[backtest] cache hit ${symbol} ${interval}`);
  }

  return candles.filter((candle) => candle.closeTime >= startTime && candle.closeTime < endTime);
};

const resampleCandles = (candles: Candle[], hours: number): Candle[] => {
  const bucketMs = hours * 60 * 60 * 1000;
  const groups = new Map<number, Candle[]>();

  for (const candle of candles) {
    const openTime = Math.floor(candle.openTime / bucketMs) * bucketMs;
    const group = groups.get(openTime) || [];
    group.push(candle);
    groups.set(openTime, group);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .filter(([, group]) => group.length === hours)
    .map(([openTime, group]) => ({
      openTime,
      open: group[0].open,
      high: Math.max(...group.map((candle) => candle.high)),
      low: Math.min(...group.map((candle) => candle.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, candle) => sum + candle.volume, 0),
      closeTime: group[group.length - 1].closeTime,
    }));
};

const upperBoundByCloseTime = (candles: Candle[], time: number): number => {
  let left = 0;
  let right = candles.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (candles[mid].closeTime < time) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
};

const getOutcome = (signal: StrategySignal, futureCandles: Candle[], maxHoldMs?: number): TradeOutcome => {
  const risk = signal.side === 'BUY' ? signal.price - signal.sl : signal.sl - signal.price;
  const maxExitTime = maxHoldMs ? signal.h4CloseTime + maxHoldMs : undefined;

  for (const candle of futureCandles) {
    if (maxExitTime && candle.openTime > maxExitTime) break;

    if (signal.side === 'BUY') {
      const hitSl = candle.low <= signal.sl;
      const hitTp = candle.high >= signal.tp;
      if (hitSl && hitTp) {
        return { result: 'SL', exit: signal.sl, exitTime: candle.closeTime, r: -1, ambiguous: true };
      }
      if (hitSl) return { result: 'SL', exit: signal.sl, exitTime: candle.closeTime, r: -1 };
      if (hitTp) return { result: 'TP', exit: signal.tp, exitTime: candle.closeTime, r: env.rewardRisk };
    } else {
      const hitSl = candle.high >= signal.sl;
      const hitTp = candle.low <= signal.tp;
      if (hitSl && hitTp) {
        return { result: 'SL', exit: signal.sl, exitTime: candle.closeTime, r: -1, ambiguous: true };
      }
      if (hitSl) return { result: 'SL', exit: signal.sl, exitTime: candle.closeTime, r: -1 };
      if (hitTp) return { result: 'TP', exit: signal.tp, exitTime: candle.closeTime, r: env.rewardRisk };
    }
  }

  const eligibleCandles = maxExitTime
    ? futureCandles.filter((candle) => candle.openTime <= maxExitTime)
    : futureCandles;
  const last = eligibleCandles[eligibleCandles.length - 1];
  if (!last || risk <= 0) {
    return { result: 'OPEN', exit: signal.price, exitTime: signal.h4CloseTime, r: 0 };
  }

  const pnl = signal.side === 'BUY' ? last.close - signal.price : signal.price - last.close;
  return { result: 'OPEN', exit: last.close, exitTime: last.closeTime, r: pnl / risk };
};

const printSummary = (trades: BacktestTrade[]): void => {
  const closed = trades.filter((trade) => trade.result !== 'OPEN');
  const wins = closed.filter((trade) => trade.result === 'TP').length;
  const losses = closed.filter((trade) => trade.result === 'SL').length;
  const open = trades.length - closed.length;
  const buys = trades.filter((trade) => trade.side === 'BUY').length;
  const sells = trades.filter((trade) => trade.side === 'SELL').length;
  const totalRClosed = closed.reduce((sum, trade) => sum + trade.r, 0);
  const totalRMark = trades.reduce((sum, trade) => sum + trade.r, 0);
  const ambiguous = trades.filter((trade) => trade.ambiguous).length;

  const bySide = Object.values(
    trades.reduce<Record<string, { side: string; trades: number; r: number; wins: number; losses: number; open: number }>>(
      (result, trade) => {
        result[trade.side] ||= { side: trade.side, trades: 0, r: 0, wins: 0, losses: 0, open: 0 };
        result[trade.side].trades += 1;
        result[trade.side].r += trade.r;
        if (trade.result === 'TP') result[trade.side].wins += 1;
        if (trade.result === 'SL') result[trade.side].losses += 1;
        if (trade.result === 'OPEN') result[trade.side].open += 1;
        return result;
      },
      {},
    ),
  ).sort((left, right) => left.side.localeCompare(right.side));

  const byMonth = Object.values(
    trades.reduce<Record<string, { month: string; trades: number; r: number; wins: number; losses: number }>>(
      (result, trade) => {
        const month = new Date(trade.signalTime).toISOString().slice(0, 7);
        result[month] ||= { month, trades: 0, r: 0, wins: 0, losses: 0 };
        result[month].trades += 1;
        result[month].r += trade.r;
        if (trade.result === 'TP') result[month].wins += 1;
        if (trade.result === 'SL') result[month].losses += 1;
        return result;
      },
      {},
    ),
  ).sort((left, right) => left.month.localeCompare(right.month));

  const bySymbol = Object.values(
    trades.reduce<Record<string, { symbol: string; trades: number; r: number; wins: number; losses: number }>>(
      (result, trade) => {
        result[trade.symbol] ||= { symbol: trade.symbol, trades: 0, r: 0, wins: 0, losses: 0 };
        result[trade.symbol].trades += 1;
        result[trade.symbol].r += trade.r;
        if (trade.result === 'TP') result[trade.symbol].wins += 1;
        if (trade.result === 'SL') result[trade.symbol].losses += 1;
        return result;
      },
      {},
    ),
  ).sort((left, right) => right.r - left.r);

  console.log('\n=== SUMMARY ===');
  console.log(`Trades=${trades.length}, Closed=${closed.length}, Open=${open}, BUY=${buys}, SELL=${sells}`);
  console.log(`TP=${wins}, SL=${losses}, Winrate(closed)=${closed.length ? formatPct(wins / closed.length) : 'n/a'}`);
  console.log(
    `Total R closed=${totalRClosed.toFixed(2)}, Total R mark-to-last=${totalRMark.toFixed(2)}, Avg R/trade=${
      trades.length ? (totalRMark / trades.length).toFixed(3) : 'n/a'
    }`,
  );
  console.log(`Same-candle TP+SL counted as SL=${ambiguous}`);

  console.log('\nBy side:');
  for (const row of bySide) {
    const closedTrades = row.wins + row.losses;
    console.log(
      `${row.side.padEnd(4)} trades=${String(row.trades).padStart(5)} TP=${String(row.wins).padStart(5)} SL=${String(
        row.losses,
      ).padStart(5)} Open=${String(row.open).padStart(3)} Winrate=${closedTrades ? formatPct(row.wins / closedTrades) : 'n/a'} R=${row.r.toFixed(
        2,
      )} AvgR=${(row.r / row.trades).toFixed(3)}`,
    );
  }

  console.log('\nBy month:');
  for (const row of byMonth) {
    console.log(
      `${row.month} trades=${String(row.trades).padStart(4)} TP=${String(row.wins).padStart(4)} SL=${String(
        row.losses,
      ).padStart(4)} R=${row.r.toFixed(2)}`,
    );
  }

  console.log('\nTop symbols by R:');
  for (const row of bySymbol.slice(0, 10)) {
    console.log(
      `${row.symbol.padEnd(12)} trades=${String(row.trades).padStart(4)} TP=${String(row.wins).padStart(
        4,
      )} SL=${String(row.losses).padStart(4)} R=${row.r.toFixed(2)}`,
    );
  }

  console.log('\nWorst symbols by R:');
  for (const row of bySymbol.slice(-10).reverse()) {
    console.log(
      `${row.symbol.padEnd(12)} trades=${String(row.trades).padStart(4)} TP=${String(row.wins).padStart(
        4,
      )} SL=${String(row.losses).padStart(4)} R=${row.r.toFixed(2)}`,
    );
  }

  console.log('\nRecent trades:');
  for (const trade of trades.slice(-20)) {
    console.log(
      `${formatDate(trade.signalTime)} scan=${formatDate(trade.scanTime)} ${trade.symbol.padEnd(12)} ${trade.side.padEnd(
        4,
      )} entry=${trade.entry} tp=${trade.tp.toFixed(8)} sl=${trade.sl.toFixed(8)} -> ${trade.result} R=${trade.r.toFixed(
        2,
      )} exit=${formatDate(trade.exitTime)}`,
    );
  }
};

const runSimulation = (
  data: SymbolCandles[],
  start: number,
  end: number,
  params: StrategyParams,
  showProgress: boolean,
): BacktestTrade[] => {
  const trades: BacktestTrade[] = [];
  const seenSignals = new Set<string>();
  const firstScan = Math.ceil(start / scanIntervalMs) * scanIntervalMs;
  const totalScans = Math.floor((end - firstScan) / scanIntervalMs) + 1;

  for (let scanIndex = 0; scanIndex < totalScans; scanIndex += 1) {
    const scanTime = firstScan + scanIndex * scanIntervalMs;

    for (const item of data) {
      const candles1hEnd = upperBoundByCloseTime(item.candles1h, scanTime);
      const candles2hEnd = upperBoundByCloseTime(item.candles2h, scanTime);
      const candles4hEnd = upperBoundByCloseTime(item.candles4h, scanTime);

      const signal = evaluateAltFlow(
        {
          symbol: item.symbol,
          candles1h: item.candles1h.slice(0, candles1hEnd),
          candles2h: item.candles2h.slice(0, candles2hEnd),
          candles4h: item.candles4h.slice(0, candles4hEnd),
        },
        {
          volLen: env.volLen,
          volMultAvg: env.volMultAvg,
          volMultPrev: env.volMultPrev,
          volMode: env.volMode,
          needCloseConfirm: env.needCloseConfirm,
          slLookback1h: params.slLookback1h,
          rewardRisk: params.rewardRisk,
        },
      );

      if (!signal) continue;

      const signalKey = `${signal.symbol}:${signal.side}:${signal.h4CloseTime}`;
      if (seenSignals.has(signalKey)) continue;
      seenSignals.add(signalKey);

      const futureCandles = item.candles15m.filter((candle) => candle.openTime >= scanTime && candle.openTime <= end);
      const outcome = getOutcome(
        signal,
        futureCandles,
        params.maxHoldHours ? params.maxHoldHours * 60 * 60 * 1000 : undefined,
      );
      trades.push({
        symbol: signal.symbol,
        side: signal.side,
        entry: signal.price,
        tp: signal.tp,
        sl: signal.sl,
        signalTime: signal.h4CloseTime,
        scanTime,
        ...outcome,
      });
    }

    if (showProgress && ((scanIndex + 1) % 1000 === 0 || scanIndex + 1 === totalScans)) {
      console.log(`Scanned ${scanIndex + 1}/${totalScans}, trades=${trades.length}`);
    }
  }

  return trades.sort((left, right) => left.signalTime - right.signalTime || left.symbol.localeCompare(right.symbol));
};

const printOptimization = (data: SymbolCandles[], start: number, end: number): void => {
  const slValues = parseNumberList(process.env.BACKTEST_OPT_SL, [2, 3, 4, 6]);
  const rrValues = parseNumberList(process.env.BACKTEST_OPT_RR, [0.3, 0.4, 0.5, 0.6, 0.8]);
  const holdValues = parseNumberList(process.env.BACKTEST_OPT_MAX_HOLD_HOURS, [2, 4, 8]);
  const rows: Array<{
    sl: number;
    rr: number;
    hold: number;
    trades: number;
    winrate: number;
    r: number;
    avgR: number;
    buyR: number;
    buyAvgR: number;
    sellR: number;
    sellAvgR: number;
  }> = [];

  for (const sl of slValues) {
    for (const rr of rrValues) {
      for (const hold of holdValues) {
      const trades = runSimulation(data, start, end, { slLookback1h: sl, rewardRisk: rr, maxHoldHours: hold }, false);
      const closed = trades.filter((trade) => trade.result !== 'OPEN');
      const wins = closed.filter((trade) => trade.result === 'TP').length;
      const buyTrades = trades.filter((trade) => trade.side === 'BUY');
      const sellTrades = trades.filter((trade) => trade.side === 'SELL');
      const r = trades.reduce((sum, trade) => sum + trade.r, 0);
      const buyR = buyTrades.reduce((sum, trade) => sum + trade.r, 0);
      const sellR = sellTrades.reduce((sum, trade) => sum + trade.r, 0);

      rows.push({
        sl,
        rr,
        hold,
        trades: trades.length,
        winrate: closed.length ? wins / closed.length : 0,
        r,
        avgR: trades.length ? r / trades.length : 0,
        buyR,
        buyAvgR: buyTrades.length ? buyR / buyTrades.length : 0,
        sellR,
        sellAvgR: sellTrades.length ? sellR / sellTrades.length : 0,
      });
      }
    }
  }

  rows.sort((left, right) => right.avgR - left.avgR);
  console.log('\n=== OPTIMIZATION BY AVG R ===');
  for (const row of rows.slice(0, 12)) {
    console.log(
      `SL=${String(row.sl).padStart(2)} RR=${row.rr.toFixed(2).padStart(4)} Hold=${String(row.hold).padStart(
        2,
      )}h trades=${String(row.trades).padStart(
        5,
      )} winrate=${formatPct(row.winrate).padStart(7)} R=${row.r.toFixed(2).padStart(8)} AvgR=${row.avgR
        .toFixed(3)
        .padStart(6)} BUY_R=${row.buyR.toFixed(2).padStart(8)} BUY_Avg=${row.buyAvgR.toFixed(3).padStart(
        6,
      )} SELL_R=${row.sellR.toFixed(2).padStart(8)} SELL_Avg=${row.sellAvgR.toFixed(3).padStart(6)}`,
    );
  }
};

const run = async (): Promise<void> => {
  const months = toNumber(process.env.BACKTEST_MONTHS, 12);
  const startDate = new Date();
  const end = Date.now();
  startDate.setUTCMonth(startDate.getUTCMonth() - months);
  const start = startDate.getTime();
  const warmupHours = Math.max(env.volLen * 2 + 10, env.slLookback1h + 10, 80);
  const warmupStart = start - warmupHours * 60 * 60 * 1000;

  const exchange = new BinanceClient(env.binanceBaseUrl, env.topSymbolsCachePath, env.topSymbolsCacheTtlMs);
  const symbols = env.scanSymbols.length > 0 ? env.scanSymbols : await exchange.getTopUsdtSymbols(env.maxSymbols);

  console.log(`Backtest ${months} month(s): ${formatDate(start)} -> ${formatDate(end)}`);
  console.log(`Scan interval: 15m, symbols=${symbols.length}, symbolCache=${env.topSymbolsCachePath}, candleCache=${getBacktestCacheDir()}`);
  console.log(`Symbols: ${symbols.join(', ')}`);
  const optimize = ['true', '1', 'yes', 'y'].includes((process.env.BACKTEST_OPTIMIZE || '').toLowerCase());
  const maxHoldHours = toNumber(process.env.BACKTEST_MAX_HOLD_HOURS, 0);
  console.log(
    `Settings: VOL_LEN=${env.volLen}, VOL_MULT_AVG=${env.volMultAvg}, VOL_MULT_PREV=${env.volMultPrev}, VOL_MODE=${env.volMode}, NEED_CLOSE_CONFIRM=${env.needCloseConfirm}, SL_LOOKBACK_1H=${env.slLookback1h}, RR=${env.rewardRisk}, MAX_HOLD_HOURS=${maxHoldHours || 'none'}, EXIT_INTERVAL=15m, OPTIMIZE=${optimize}`,
  );

  const data: SymbolCandles[] = [];
  const errors: Array<{ symbol: string; message: string }> = [];

  const loadConcurrency = Math.max(1, toNumber(process.env.BACKTEST_LOAD_CONCURRENCY, 2));

  for (let index = 0; index < symbols.length; index += loadConcurrency) {
    const batch = symbols.slice(index, index + loadConcurrency);
    const batchData = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const [candles15m, candles1h] = await Promise.all([
            getCachedCandlesInRange(exchange, symbol, '15m', warmupStart, end),
            getCachedCandlesInRange(exchange, symbol, '1h', warmupStart, end),
          ]);
          return {
            symbol,
            candles15m,
            candles1h,
            candles2h: resampleCandles(candles1h, 2),
            candles4h: resampleCandles(candles1h, 4),
          };
        } catch (error) {
          errors.push({ symbol, message: error instanceof Error ? error.message : String(error) });
          return null;
        }
      }),
    );

    data.push(...batchData.filter((item): item is SymbolCandles => Boolean(item)));
    console.log(`Loaded ${Math.min(index + batch.length, symbols.length)}/${symbols.length}, errors=${errors.length}`);
    await sleep(300);
  }

  const trades = runSimulation(
    data,
    start,
    end,
    { slLookback1h: env.slLookback1h, rewardRisk: env.rewardRisk, maxHoldHours: maxHoldHours || undefined },
    true,
  );
  printSummary(trades);

  if (optimize) {
    printOptimization(data, start, end);
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    for (const error of errors.slice(0, 20)) {
      console.log(`${error.symbol}: ${error.message}`);
    }
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
