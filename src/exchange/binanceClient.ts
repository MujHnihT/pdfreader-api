import axios from 'axios';
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

interface ExchangeInfo {
  symbols: Array<{
    symbol: string;
    status: string;
    quoteAsset: string;
    contractType?: string;
  }>;
}

export class BinanceClient {
  constructor(private readonly baseUrl: string) {}

  async getTopUsdtSymbols(limit: number): Promise<string[]> {
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

    return tickerRes.data
      .filter((ticker) => tradable.has(ticker.symbol))
      .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
      .slice(0, limit)
      .map((ticker) => ticker.symbol);
  }

  async getClosedCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const response = await axios.get<BinanceKline[]>(`${this.baseUrl}/fapi/v1/klines`, {
      params: { symbol, interval, limit },
      timeout: 15000,
    });

    const now = Date.now();
    return response.data
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
}
