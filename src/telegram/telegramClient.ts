import axios from 'axios';
import { StrategySignal } from '../strategy/types';

export interface ExitNotification {
  signal: StrategySignal;
  exitPrice: number;
  reason: string;
  checkedAt: number;
}

export interface PriceJumpSummary {
  symbol: string;
  jumps: number;
  upJumps: number;
  downJumps: number;
  unchanged: number;
  open: number;
  close: number;
  high: number;
  low: number;
  changePercent: number;
  rangePercent: number;
  fromTime: number;
  toTime: number;
}

export class TelegramClient {
  constructor(
    private readonly sendMessageUrl: string,
    private readonly botToken: string,
    private readonly chatId: string,
    private readonly maxHoldHours = 0,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.sendMessageUrl || (this.botToken && this.chatId));
  }

  async sendSignal(signal: StrategySignal): Promise<void> {
    await this.sendMessage(this.formatSignal(signal));
  }

  async sendSignalList(signals: StrategySignal[]): Promise<void> {
    if (signals.length === 0) return;
    await this.sendMessage(this.formatSignalList(signals));
  }

  async sendExitList(exits: ExitNotification[]): Promise<void> {
    if (exits.length === 0) return;
    await this.sendMessage(this.formatExitList(exits));
  }

  async sendPriceJumpReport(summaries: PriceJumpSummary[], lookbackMinutes: number): Promise<void> {
    if (summaries.length === 0) return;
    await this.sendMessage(this.formatPriceJumpReport(summaries, lookbackMinutes));
  }

  private async sendMessage(text: string): Promise<void> {
    if (!this.isConfigured()) {
      console.warn('Telegram is not configured. Message skipped.');
      return;
    }

    if (this.sendMessageUrl) {
      await axios.get(this.sendMessageUrl, {
        params: { text, parse_mode: 'HTML', disable_web_page_preview: true },
        timeout: 15000,
      });
      return;
    }

    await axios.post(
      `https://api.telegram.org/bot${this.botToken}/sendMessage`,
      {
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      },
      { timeout: 15000 },
    );
  }

  private formatSignalList(signals: StrategySignal[]): string {
    const buySignals = signals.filter((signal) => signal.side === 'BUY');
    const sellSignals = signals.filter((signal) => signal.side === 'SELL');
    const time = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
    });

    return [
      `<b>ALT FLOW SIGNALS</b>`,
      `Time: <code>${this.escapeHtml(time)}</code>`,
      '',
      `<b>BUY (${buySignals.length})</b>`,
      buySignals.length > 0 ? buySignals.map((signal) => this.formatSignalLine(signal)).join('\n') : '<code>None</code>',
      '',
      `<b>SELL (${sellSignals.length})</b>`,
      sellSignals.length > 0 ? sellSignals.map((signal) => this.formatSignalLine(signal)).join('\n') : '<code>None</code>',
      this.maxHoldHours > 0 ? `\nMax hold: <code>${this.maxHoldHours}h</code>` : '',
    ].join('\n');
  }

  private formatSignalLine(signal: StrategySignal): string {
    return [
      `<code>${this.escapeHtml(signal.symbol)}</code>`,
      `Entry <code>${this.formatNumber(signal.price)}</code>`,
      `TP <code>${this.formatNumber(signal.tp)}</code>`,
      `SL <code>${this.formatNumber(signal.sl)}</code>`,
      ...(this.maxHoldHours > 0 ? [`Hold &lt;= <code>${this.maxHoldHours}h</code>`] : []),
    ].join(' | ');
  }

  private formatSignal(signal: StrategySignal): string {
    const time = new Date(signal.h4CloseTime).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
    });
    const symbol = this.escapeHtml(signal.symbol);
    const side = this.escapeHtml(signal.side);
    const price = this.formatNumber(signal.price);
    const tp = this.formatNumber(signal.tp);
    const sl = this.formatNumber(signal.sl);

    return [
      `<b>${side} SIGNAL</b>`,
      `Pair: <code>${symbol}</code>`,
      `Entry: <code>${price}</code>`,
      `TP: <code>${tp}</code>`,
      `SL: <code>${sl}</code>`,
      ...(this.maxHoldHours > 0 ? [`Max hold: <code>${this.maxHoldHours}h</code>`] : []),
      `H4 close: <code>${this.escapeHtml(time)}</code>`,
    ].join('\n');
  }

  private formatExitList(exits: ExitNotification[]): string {
    const time = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
    });

    return [
      `<b>ALT FLOW EXIT</b>`,
      `Time: <code>${this.escapeHtml(time)}</code>`,
      '',
      exits.map((exit) => this.formatExitLine(exit)).join('\n'),
    ].join('\n');
  }

  private formatExitLine(exit: ExitNotification): string {
    const signal = exit.signal;
    return [
      `<code>${this.escapeHtml(signal.symbol)}</code>`,
      `Exit <code>${this.escapeHtml(signal.side)}</code>`,
      `Price <code>${this.formatNumber(exit.exitPrice)}</code>`,
      `Entry <code>${this.formatNumber(signal.price)}</code>`,
      `Reason <code>${this.escapeHtml(exit.reason)}</code>`,
    ].join(' | ');
  }

  private formatPriceJumpReport(summaries: PriceJumpSummary[], lookbackMinutes: number): string {
    const time = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
    });

    return [
      `<b>PRICE JUMP TOP COINS</b>`,
      `Time: <code>${this.escapeHtml(time)}</code>`,
      `Window: <code>${lookbackMinutes}m</code>`,
      '',
      summaries.map((summary, index) => this.formatPriceJumpLine(summary, index + 1)).join('\n'),
    ].join('\n');
  }

  private formatPriceJumpLine(summary: PriceJumpSummary, rank: number): string {
    const change = `${summary.changePercent >= 0 ? '+' : ''}${summary.changePercent.toFixed(2)}%`;
    return [
      `<code>${rank}. ${this.escapeHtml(summary.symbol)}</code>`,
      `Nhịp <code>${summary.jumps}</code>`,
      `Up/Down <code>${summary.upJumps}/${summary.downJumps}</code>`,
      `Change <code>${change}</code>`,
      `Range <code>${summary.rangePercent.toFixed(2)}%</code>`,
      `Close <code>${this.formatNumber(summary.close)}</code>`,
    ].join(' | ');
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? value.toString() : value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
