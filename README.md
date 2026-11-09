# OPTIMIST LUDO BOT

Новый чистый репозиторий проекта. Игровую основу строим независимо от прежнего приложения; старые репозитории используются только как справочник и источник одобренных собственных ассетов.

## Первый этап: CLASSIC board foundation

- Геометрический эталон: `assets/boards/ludo-board-prototype.svg`.
- Каноническая логическая сетка: 15 × 15.
- Внешний маршрут: 52 клетки.
- Домашняя дорожка: 5 клеток на цвет.
- 4 игрока, 4 героя-фишки на игрока.
- Координаты и маршрут хранятся отдельно от будущего художественного оформления.
- Анимация обязана проходить через каждую клетку маршрута, подтверждённую сервером.

## Цвета и стороны прототипа

По исходной SVG-композиции:

| Цвет | База | Домашняя дорожка | Стартовый индекс |
|---|---|---|---:|
| GREEN | верхняя левая | левая | 39 |
| YELLOW | верхняя правая | верхняя | 0 |
| BLUE | нижняя правая | правая | 13 |
| RED | нижняя левая | нижняя | 26 |

Это соответствие является контрактом визуального слоя. Цвет нельзя автоматически переименовывать ради совпадения со старой реализацией.

## Геометрический источник

Прототип — **Ludo board 2.svg**, автор Alpha Arts / Openclipart, CC0 1.0. Оригинальная запись на Wikimedia Commons:
https://commons.wikimedia.org/wiki/File:Ludo_board_2.svg

В репозитории хранится неизменённая копия SVG для сверки. Будущий фирменный дизайн будет перерисован поверх тех же координат, а не будет растягивать или перемещать игровую сетку.

## Размеры персонажей

Каталог `assets/characters/` содержит 12 исходных WebP персонажей из прежнего собственного репозитория OPTIMIST LUDO. Файлы имеют близкую высоту около 507–508 px; рендерер использует нормализацию по высоте, а не одинаковую ширину.

## Разработка

Требуется Node.js 22+.

```bash
npm test
```

Текущий первый коммит предназначен для фиксации геометрического контракта и тестов координат. Игровой backend, Telegram-авторизация, комнаты, чат и голосовые сообщения подключаются отдельными проверяемыми этапами.


## Browser demo

Run the first interactive CLASSIC browser board locally with Node.js 22+:

```bash
npm run dev
```

Then open `http://localhost:4173` in a browser. Build a deployable static site with `npm run build:web`; GitHub Pages deployment is configured in `.github/workflows/pages.yml`. The prototype uses the real Classic rules engine and the same movement/capture animation pipeline as the game foundation. Roll the die, tap a highlighted pawn to move it, and use **Новая партия** to reset.

The current browser demo runs locally or can be published to GitHub Pages after enabling Pages once in the repository settings. For local-only testing, dice are generated in the browser. Network rooms and server-authoritative moves are documented below.


## Backend API foundation

The first authenticated room API is in `apps/backend/`. Run it with `npm run start:api` (default port 4174). It creates and joins 2–4 player rooms, starts games as the host, generates dice on the server, and validates moves with the Classic engine. See [docs/BACKEND-ROOM-API.md](docs/BACKEND-ROOM-API.md) for endpoints and current limitations.

**Important:** room storage uses PostgreSQL when `DATABASE_URL` is configured (otherwise local development uses memory). Authenticated WebSocket snapshots and optimistic concurrency are implemented. Telegram initData authentication, spectator mode, multi-instance event fan-out and production hardening remain outstanding.


## PostgreSQL persistence

Set `DATABASE_URL` in the backend environment to enable persistent rooms. Production startup refuses to use volatile memory when the database URL is missing. Run `npm install`, optionally `npm run db:init`, then `npm run start:api`. Setup, schema and current limitations: [docs/POSTGRES-PERSISTENCE.md](docs/POSTGRES-PERSISTENCE.md).


## Realtime and concurrency

Room writes use optimistic version checks to reject stale simultaneous actions with HTTP 409. Authenticated players request a short-lived, single-use WebSocket ticket at `POST /api/rooms/:code/ticket`, then subscribe to `/api/rooms/:code/events?ticket=...` for committed room snapshots. The browser client now sends dice rolls and pawn moves to the authenticated server API; the server owns dice generation and validates every move. See [docs/REALTIME-AND-CONCURRENCY.md](docs/REALTIME-AND-CONCURRENCY.md).


## Local multiplayer development

Run the browser app and the room API in two terminals:

```bash
npm run dev
npm run start:api
```

Open `http://localhost:4173`. The browser client uses `http://localhost:4174` for room HTTP requests and WebSocket events by default. For a deployed Mini App, set `window.OPTIMIST_API_BASE` to the public HTTPS origin of the API before loading `apps/web/main.mjs`, and set the API process `WEB_ORIGIN` to the exact public Mini App origin (comma-separated origins are supported). The API must be reachable over HTTPS/WSS from the Mini App.

The current client supports creating a room, joining by code while the room is waiting, host-start, server-side dice/moves and live room snapshots. Refreshing the page attempts to restore the saved player session. A polished reconnect/backoff flow, spectator mode, Telegram initData authentication, and multi-instance event fan-out are not implemented yet.
