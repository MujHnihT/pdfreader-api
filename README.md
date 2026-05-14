# Alt Flow Coin Scanner

Cron service scan coin theo logic từ `strategy/pine.js` và gửi tín hiệu về Telegram.

## Logic signal

- Lấy nến đã đóng cho `1h`, `2h`, `4h`.
- Volume kick:
  - `volume > SMA(volume, VOL_LEN) * VOL_MULT_AVG`
  - `volume > previousVolume * VOL_MULT_PREV`
  - `VOL_MODE=AND` yêu cầu cả 1H và 2H. `VOL_MODE=OR` chỉ cần một trong hai.
- BUY khi volume kick và nến H4 xanh.
- SELL khi volume kick và nến H4 đỏ.
- TP/SL:
  - BUY: SL là low thấp nhất của `SL_LOOKBACK_1H` nến 1H gần nhất, TP theo `REWARD_RISK`.
  - SELL: SL là high cao nhất của `SL_LOOKBACK_1H` nến 1H gần nhất, TP theo `REWARD_RISK`.

## Cấu hình

Tạo `.env` từ `.env.example`.

```bash
cp .env.example .env
```

Telegram có 2 cách cấu hình:

```env
TELEGRAM_SEND_MESSAGE_URL=https://api.telegram.org/bot<token>/sendMessage?chat_id=<chat_id>
```

hoặc:

```env
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_CHAT_ID=<chat_id>
```

## Chạy

```bash
npm install
npm run build
npm start
```

Dev:

```bash
npm run dev
```

Trigger scan thủ công:

```bash
curl -X POST http://localhost:3000/scan
```

Endpoint cũ vẫn được giữ:

```bash
curl http://localhost:3000/api/cron
```

## Deploy Vercel

`vercel.json` đã cấu hình Vercel Cron gọi `/api/cron/vercel` mỗi 15 phút:

```json
"schedule": "*/15 * * * *"
```

Khi deploy lên Vercel, set các biến môi trường giống `.env.example`. Trên Vercel không dùng `node-cron` chạy nền; cron của Vercel sẽ gọi endpoint serverless.

## Nguồn dữ liệu

Implementation hiện dùng Binance public OHLCV vì logic Pine cần nến `1h/2h/4h` và volume. Coinglass/CoinMarketCap thường cần API key hoặc không cung cấp đủ OHLCV miễn phí cho flow này. Có thể thay client trong `src/exchange/binanceClient.ts` nếu bạn muốn đổi sang provider khác.
