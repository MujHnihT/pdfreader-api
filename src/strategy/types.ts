export type SignalSide = 'BUY' | 'SELL';

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface StrategySettings {
  volLen: number;
  volMultAvg: number;
  volMultPrev: number;
  volMode: 'AND' | 'OR';
  needCloseConfirm: boolean;
  slLookback1h: number;
  rewardRisk: number;
}

export interface StrategyInput {
  symbol: string;
  candles1h: Candle[];
  candles2h: Candle[];
  candles4h: Candle[];
}

export interface StrategySignal {
  symbol: string;
  side: SignalSide;
  price: number;
  tp: number;
  sl: number;
  h4CloseTime: number;
  volume: {
    vol1h: number;
    vol1hMA: number;
    vol2h: number;
    vol2hMA: number;
  };
}
