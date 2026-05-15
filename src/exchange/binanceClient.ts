import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { Candle } from '../strategy/types';

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

interface BinanceTicker {
  symbol: string;
  quoteVolume: string;
}

interface BinancePriceTicker {
  symbol: string;
  price: string;
  time?: number;
}

interface ExchangeInfo {
  symbols: Array<{
    symbol: string;
    status: string;
    quoteAsset: string;
    contractType?: string;
  }>;
}

interface TopSymbolsCache {
  baseUrl: string;
  limit: number;
  createdAt: number;
  symbols: string[];
}

export class BinanceClient {
  constructor(
    private readonly baseUrl: string,
    private readonly topSymbolsCachePath?: string,
    private readonly topSymbolsCacheTtlMs = 60 * 60 * 1000,
  ) {}

  async getTopUsdtSymbols(limit: number): Promise<string[]> {
    const cached = await this.readTopSymbolsCache(limit);
    if (cached) {
      return cached;
    }

    const [exchangeInfoRes, tickerRes] = await Promise.all([
      axios.get<ExchangeInfo>(`${this.baseUrl}/fapi/v1/exchangeInfo`, { timeout: 15000 }),
      axios.get<BinanceTicker[]>(`${this.baseUrl}/fapi/v1/ticker/24hr`, { timeout: 15000 }),
    ]);

    const tradable = new Set(
      exchangeInfoRes.data.symbols
        .filter(
          (symbol) =>
            symbol.status === 'TRADING' &&
            symbol.quoteAsset === 'USDT' &&
            (!symbol.contractType || symbol.contractType === 'PERPETUAL'),
        )
        .map((symbol) => symbol.symbol),
    );

    const symbols = tickerRes.data
      .filter((ticker) => tradable.has(ticker.symbol))
      .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
      .slice(0, limit)
      .map((ticker) => ticker.symbol);

    await this.writeTopSymbolsCache(limit, symbols);
    return symbols;
  }

  async getClosedCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const data = await this.getKlinesWithRetry({ symbol, interval, limit }, 15000);

    const now = Date.now();
    return data
      .map((item) => ({
        openTime: item[0],
        open: Number(item[1]),
        high: Number(item[2]),
        low: Number(item[3]),
        close: Number(item[4]),
        volume: Number(item[5]),
        closeTime: item[6],
      }))
      .filter((candle) => candle.closeTime < now);
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    const response = await axios.get<BinancePriceTicker>(`${this.baseUrl}/fapi/v1/ticker/price`, {
      params: { symbol },
      timeout: 15000,
    });
    const price = Number(response.data.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Invalid ticker price for ${symbol}: ${response.data.price}`);
    }
    return price;
  }

  async getCandlesInRange(symbol: string, interval: string, startTime: number, endTime: number): Promise<Candle[]> {
    const candles: Candle[] = [];
    let cursor = startTime;

    while (cursor < endTime) {
      const data = await this.getKlinesWithRetry({ symbol, interval, startTime: cursor, endTime, limit: 1500 }, 30000);

      if (data.length === 0) break;

      candles.push(
        ...data.map((item) => ({
          openTime: item[0],
          open: Number(item[1]),
          high: Number(item[2]),
          low: Number(item[3]),
          close: Number(item[4]),
          volume: Number(item[5]),
          closeTime: item[6],
        })),
      );

      const nextCursor = data[data.length - 1][6] + 1;
      if (nextCursor <= cursor) break;
      cursor = nextCursor;
      if (data.length === 1500) {
        await this.sleep(100);
      }
    }

    return candles.filter((candle) => candle.closeTime < endTime);
  }

  private async getKlinesWithRetry(params: Record<string, string | number>, timeout: number): Promise<BinanceKline[]> {
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await axios.get<BinanceKline[]>(`${this.baseUrl}/fapi/v1/klines`, {
          params,
          timeout,
        });
        return response.data;
      } catch (error) {
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        const retryAfterHeader = axios.isAxiosError(error) ? error.response?.headers['retry-after'] : undefined;
        const retryable = status === 418 || status === 429 || (status !== undefined && status >= 500);
        if (!retryable || attempt === maxAttempts) throw error;

        const retryAfter = Array.isArray(retryAfterHeader) ? retryAfterHeader[0] : retryAfterHeader;
        const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : 0;
        const backoffMs = retryAfterMs > 0 ? retryAfterMs : 1000 * attempt * attempt;
        console.warn(`[binance] retrying klines after status=${status}, attempt=${attempt}/${maxAttempts}`);
        await this.sleep(backoffMs);
      }
    }

    return [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async readTopSymbolsCache(limit: number): Promise<string[] | null> {
    if (!this.topSymbolsCachePath || this.topSymbolsCacheTtlMs <= 0) return null;

    try {
      const raw = await fs.readFile(this.topSymbolsCachePath, 'utf8');
      const cache = JSON.parse(raw) as TopSymbolsCache;
      const fresh = Date.now() - cache.createdAt <= this.topSymbolsCacheTtlMs;
      if (fresh && cache.baseUrl === this.baseUrl && cache.limit === limit && Array.isArray(cache.symbols)) {
        return cache.symbols;
      }
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
      if (code !== 'ENOENT') {
        console.warn(`[binance] ignored top symbols cache: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return null;
  }

  private async writeTopSymbolsCache(limit: number, symbols: string[]): Promise<void> {
    if (!this.topSymbolsCachePath || this.topSymbolsCacheTtlMs <= 0) return;

    try {
      await fs.mkdir(path.dirname(this.topSymbolsCachePath), { recursive: true });
      const cache: TopSymbolsCache = {
        baseUrl: this.baseUrl,
        limit,
        createdAt: Date.now(),
        symbols,
      };
      await fs.writeFile(this.topSymbolsCachePath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
    } catch (error) {
      console.warn(`[binance] could not write top symbols cache: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
