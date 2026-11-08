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

Then open `http://localhost:4173` in a browser. The prototype uses the real Classic rules engine and the same movement/capture animation pipeline as the game foundation. Roll the die, tap a highlighted pawn to move it, and use **Новая партия** to reset.

The current browser demo is local-only. Dice are generated in the browser for testing; multiplayer rooms, server-authoritative random rolls, reconnect persistence, Telegram WebApp integration, chat and voice are not implemented yet.
