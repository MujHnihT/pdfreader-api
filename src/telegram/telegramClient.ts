import axios from 'axios';
import { StrategySignal } from '../strategy/types';

export class TelegramClient {
  constructor(
    private readonly sendMessageUrl: string,
    private readonly botToken: string,
    private readonly chatId: string,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.sendMessageUrl || (this.botToken && this.chatId));
  }

  async sendSignal(signal: StrategySignal): Promise<void> {
    if (!this.isConfigured()) {
      console.warn('Telegram is not configured. Signal skipped:', signal.symbol, signal.side);
      return;
    }

    const text = this.formatSignal(signal);
    if (this.sendMessageUrl) {
      await axios.get(this.sendMessageUrl, {
        params: { text },
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

  private formatSignal(signal: StrategySignal): string {
    const time = new Date(signal.h4CloseTime).toISOString();
    return [
      `${signal.side} ${signal.symbol}`,
      `Price: ${this.formatNumber(signal.price)}`,
      `TP: ${this.formatNumber(signal.tp)}`,
      `SL: ${this.formatNumber(signal.sl)}`,
      `H4 close: ${time}`,
      `Vol 1H: ${this.formatNumber(signal.volume.vol1h)} / MA ${this.formatNumber(signal.volume.vol1hMA)}`,
      `Vol 2H: ${this.formatNumber(signal.volume.vol2h)} / MA ${this.formatNumber(signal.volume.vol2hMA)}`,
    ].join('\n');
  }

  private formatNumber(value: number): string {
    return Number.isInteger(value) ? value.toString() : value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  }
}
