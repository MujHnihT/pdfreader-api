import { Candle, StrategyInput, StrategySettings, StrategySignal } from './types';

const sma = (values: number[]): number => {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const last = <T>(items: T[]): T | undefined => items[items.length - 1];

const getVolumeKick = (
  candles: Candle[],
  volLen: number,
  volMultAvg: number,
  volMultPrev: number,
): { kick: boolean; volume: number; ma: number } => {
  if (candles.length < volLen + 2) {
    return { kick: false, volume: 0, ma: 0 };
  }

  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const maCandles = candles.slice(-volLen);
  const volumeMA = sma(maCandles.map((candle) => candle.volume));

  return {
    kick: current.volume > volumeMA * volMultAvg && current.volume > previous.volume * volMultPrev,
    volume: current.volume,
    ma: volumeMA,
  };
};

const highest = (candles: Candle[]): number => Math.max(...candles.map((candle) => candle.high));
const lowest = (candles: Candle[]): number => Math.min(...candles.map((candle) => candle.low));

export const evaluateAltFlow = (
  input: StrategyInput,
  settings: StrategySettings,
): StrategySignal | null => {
  const h4 = last(input.candles4h);
  const prevH4 = input.candles4h[input.candles4h.length - 2];
  if (!h4 || !prevH4) return null;

  const vol1h = getVolumeKick(input.candles1h, settings.volLen, settings.volMultAvg, settings.volMultPrev);
  const vol2h = getVolumeKick(input.candles2h, settings.volLen, settings.volMultAvg, settings.volMultPrev);
  const volumeKick = settings.volMode === 'AND' ? vol1h.kick && vol2h.kick : vol1h.kick || vol2h.kick;
  if (!volumeKick) return null;

  const h4Green = h4.close > h4.open;
  const h4Red = h4.close < h4.open;
  const buyConfirm = settings.needCloseConfirm ? h4Green && h4.close > prevH4.close : h4Green;
  const sellConfirm = settings.needCloseConfirm ? h4Red && h4.close < prevH4.close : h4Red;

  const slCandles = input.candles1h.slice(-settings.slLookback1h);
  if (slCandles.length < settings.slLookback1h) return null;

  if (buyConfirm) {
    const sl = lowest(slCandles);
    const risk = h4.close - sl;
    if (risk <= 0) return null;
    return {
      symbol: input.symbol,
      side: 'BUY',
      price: h4.close,
      tp: h4.close + risk * settings.rewardRisk,
      sl,
      h4CloseTime: h4.closeTime,
      volume: { vol1h: vol1h.volume, vol1hMA: vol1h.ma, vol2h: vol2h.volume, vol2hMA: vol2h.ma },
    };
  }

  if (sellConfirm) {
    const sl = highest(slCandles);
    const risk = sl - h4.close;
    if (risk <= 0) return null;
    return {
      symbol: input.symbol,
      side: 'SELL',
      price: h4.close,
      tp: h4.close - risk * settings.rewardRisk,
      sl,
      h4CloseTime: h4.closeTime,
      volume: { vol1h: vol1h.volume, vol1hMA: vol1h.ma, vol2h: vol2h.volume, vol2hMA: vol2h.ma },
    };
  }

  return null;
};
