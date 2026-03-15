# Activity Tracker

Сервис трекинга активности посетителя сайта. Браузерный трекер собирает события пользователя и отправляет их на бекенд, который сохраняет их в MongoDB.

## Требования

- Node.js 20+
- MongoDB, запущенный на `localhost:27017`

По умолчанию приложение подключается к MongoDB по адресу `mongodb://localhost:27017`.
Если у вас другой адрес, порт или включена авторизация, измените `MONGO_URL` в [src/server/server.config.ts](src/server/server.config.ts).

## Установка

```bash
npm install
```

## Сборка

```bash
npm run build
```

## Запуск

```bash
npm start
```

Приложение поднимает два сервера:

- `http://localhost:50000` - сайт со страницами `/1.html`, `/2.html`, `/3.html`
- `http://localhost:8888` - API трекинга (`GET /tracker`, `POST /track`)

## Разработка

```bash
npm run dev
```

## Форматирование

```bash
npm run format
```

## Ручная проверка

После `npm start` откройте Chrome DevTools, вкладку `Network`, и проверьте:

1. Откройте `http://localhost:50000/1.html` - страница загружается, а скрипт трекера асинхронно запрашивается с `:8888/tracker`.
2. Примерно через секунду появляется `POST /track` с событиями `pageview` и `test`.
3. Запрос уходит с `Content-Type: text/plain` и без `OPTIONS` preflight.
4. Нажатие на кнопку `Click me` отправляет событие `click-button`.
5. Клик по ссылке перехватывается, буферизованные события отправляются на бекенд, затем происходит переход на новую страницу.
6. События сохраняются в MongoDB:

```bash
mongosh tracker --eval "db.tracks.find().pretty()"
```
