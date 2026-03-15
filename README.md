# Activity Tracker

Website visitor activity tracking service. A browser-side tracker collects user events (page views, clicks, navigation) and sends them to a backend that stores them in MongoDB.

## Prerequisites

- Node.js 20+
- MongoDB running on `localhost:27017`

## Install

```
npm install
```

## Build

```
npm run build
```

## Run

```
npm start
```

The app starts two servers:

- `http://localhost:50000` — website (pages `/1.html`, `/2.html`, `/3.html`)
- `http://localhost:8888` — tracking API (`GET /tracker`, `POST /track`)

## Development

```
npm run dev
```

## Format

```
npm run format
```

## Verification

After `npm start`, open Chrome DevTools (Network tab) and check:

1. Open `http://localhost:50000/1.html` — page loads, tracker script is fetched asynchronously from `:8888/tracker`
2. Within ~1 second, a `POST /track` request appears with `pageview` and `test` events
3. The POST uses `Content-Type: text/plain` — no `OPTIONS` preflight request
4. Click "Click me" — a `click-button` event is sent
5. Click a page link — navigation is intercepted, buffered events are delivered to the backend, then the page transitions
6. Check MongoDB: `mongosh tracker --eval "db.tracks.find().pretty()"`
