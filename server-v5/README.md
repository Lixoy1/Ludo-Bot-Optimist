> Серверное развёртывание: см. [SERVER-DEPLOY.md](SERVER-DEPLOY.md).

# Optimist Ludo — Telegram Mini App

Готовая сборка игры **Optimist Ludo** с твоими 12 персонажами, двумя кастомными досками (`Optimist Neon` и `Optimist Royal`), единым центральным кубиком снизу экрана, бесплатным голосовым чатом (WebRTC) и групповыми лобби для Telegram.

## Структура проекта
- `server.py` — единый сервер (FastAPI + WebSockets + SQLite + Telegram-бот на `aiogram 3`).
- `index.html` — игровой клиент с единым центральным кубиком и 4 углами игроков.
- `cabinet.html` — личный кабинет: выбор любого из 12 персонажей, 2 досок и любимого цвета.
- `static/css/style.css`, `skins.css` — стили доски, точное позиционирование сетки 15×15 внутри декоративной рамки и посадка фигурок.
- `static/js/skins.js` — подключение всех 12 персонажей (`optimist`, `elvina`, `cat`, `husky`, `ksyusha`, `lena`, `lilya-detective`, `natalie`, `nikita`, `owl`, `poison`, `raccoon`).
- `static/js/themes.js` — кастомные доски `board-neon.png` и `board-royal.png`.
- `static/js/main.js`, `voice.js`, `stickers.js`, `sticker_sfx.js` — игровой движок, раскладка 4 фишек «игральной костью» и голосовой чат без ограничений.

## Быстрый запуск
1. Установи зависимости:
   ```bash
   pip install -r requirements.txt
   ```
2. Укажи токен бота и HTTPS-адрес твоего сервера (или туннеля `ngrok` / `cloudflared`):
   ```bash
   export BOT_TOKEN="твой_токен_от_BotFather"
   export WEBAPP_URL="https://твой-домен.ru"
   export APP_ENV="production"
   unset ALLOW_DEV_AUTH
   ```
   Для локальной проверки в браузере без Telegram временно используй `APP_ENV=development` и `ALLOW_DEV_AUTH=true`. Не включай этот режим на публичном сервере.
3. Чтобы голосовой чат работал и за строгими NAT, настрой coturn и задай `TURN_URLS` и `TURN_SHARED_SECRET`. Сервер выдаёт WebRTC-клиенту временные учётные данные на один час. Без TURN остаётся STUN, который работает не во всех сетях.
4. Запусти проект:
   ```bash
   uvicorn server:app --host 0.0.0.0 --port 8000
   ```
5. В `@BotFather` включи **Allow Groups** и отключи **Group Privacy** (`Turn off`), чтобы бот мог создавать лобби по команде `/game` в любых групповых чатах.
