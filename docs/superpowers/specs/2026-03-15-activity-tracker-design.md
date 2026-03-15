# Activity Tracker — Design Spec

## Overview

Website visitor activity tracking service. A browser-side tracker collects user events (page views, clicks) and sends them to a backend that stores them in MongoDB.

## Tech Stack

- **Runtime:** Node.js, TypeScript
- **Backend framework:** Fastify (two instances, ports 50000 and 8888)
- **Database:** MongoDB (native `mongodb` driver)
- **Tracker bundler:** esbuild (IIFE output)
- **Formatter:** Prettier (default config)

## Project Structure

```
src/
  server/
    index.ts            — entry point: connect to MongoDB, start both servers
    site-server.ts      — Fastify on port 50000, serves HTML page
    tracking-server.ts  — Fastify on port 8888: GET /tracker, POST /track
    db.ts               — MongoDB connection, insertEvents()
    page.html           — HTML page with tracker snippet
  tracker/
    tracker.ts          — client-side tracker code (TypeScript → IIFE via esbuild)

tsconfig.json           — server TS config
tsconfig.tracker.json   — tracker TS config (for IDE type-checking)
package.json
.prettierrc
.gitignore
README.md
```

## Data Flow

1. Browser requests `localhost:50000/1.html` → `site-server` returns `page.html`
2. HTML contains inline snippet that async-loads `localhost:8888/tracker`
3. `tracking-server` serves the bundled tracker JS
4. Tracker buffers events and sends `POST` to `localhost:8888/track`
5. `tracking-server` validates payload, responds 200/422, then asynchronously inserts into MongoDB via `insertMany` (fire-and-forget)

## Tracker (Client-Side)

### Public API

```typescript
interface Tracker {
  track(event: string, ...tags: string[]): void;
}
```

Global `tracker` variable on `window`.

### Event Structure

```json
{
  "event": "pageview",
  "tags": [],
  "url": "http://localhost:50000/1.html",
  "title": "My website",
  "ts": 1675209600
}
```

### Buffer and Flush Logic

- Events are pushed into `buffer: TrackEvent[]` on each `track()` call.
- Flush triggers (any one is sufficient):
  - Buffer has >= 3 events → flush immediately
  - 1 second passed since first event entered the current buffer → flush via `setTimeout`
  - Page is being closed → flush via `sendBeacon`
- Timer: started when first event enters empty buffer. Cleared if buffer reaches 3 events earlier.

### Sending Data

- Normal flush: `fetch()` with `Content-Type: text/plain` (body is `JSON.stringify(events)`). Avoids CORS preflight — request stays "simple".
- Page close: `visibilitychange` event with `document.visibilityState === 'hidden'` → `navigator.sendBeacon()`.
- Link clicks: `sendBeacon()` before navigation to guarantee delivery.

### Network Error Handling

If `fetch` fails — wait 1 second (`setTimeout`), return events to the front of the buffer. They will be sent again by normal rules.

### Custom Snippet (Bonus)

Instead of `<script src="..."></script>`, an inline snippet:

```html
<script>
  (function(w, d, s, u) {
    w.tracker = { q: [], track: function() { this.q.push(arguments); } };
    var f = d.createElement(s); f.async = true; f.src = u;
    d.head.appendChild(f);
  })(window, document, 'script', 'http://localhost:8888/tracker');
</script>
```

Benefits:
- Script loads **asynchronously**, does not block page rendering
- `tracker.track()` calls work **before the script loads** — they queue into `q`
- When the real tracker loads, it drains `q`, executes queued calls, and replaces the stub

### Link Navigation (Bonus)

On link click, if buffer is not empty, call `sendBeacon()` before navigation. `sendBeacon` is non-blocking and guaranteed by the browser.

## Backend

### Site Server (port 50000)

Fastify instance. Serves `page.html` for paths matching `/1.html`, `/2.html`, `/3.html`. Returns 404 for everything else.

### Tracking Server (port 8888)

**`GET /tracker`** — serves the built tracker JS file. Read into memory at startup, served with `Content-Type: application/javascript`.

**`POST /track`** — receives event array.

Processing:
1. Parse body as JSON (arrives as `text/plain` — register custom content-type parser in Fastify)
2. Validate: body is a non-empty array; each element has `event` (non-empty string), `tags` (string array), `url` (non-empty string), `title` (string), `ts` (number > 0); no extra fields allowed
3. Valid → respond 200 immediately, then fire-and-forget `insertMany` into `tracks` collection
4. Invalid → respond 422

**CORS:** Add `Access-Control-Allow-Origin: *` header to tracking-server responses. With `Content-Type: text/plain`, browser skips preflight OPTIONS.

### Validation

Manual validation function after JSON parsing (since body arrives as `text/plain`, Fastify's built-in JSON Schema validation doesn't apply directly). Simple function checking structure and types.

### Database (db.ts)

- `connect()` — connect to `mongodb://localhost:27017`, database `tracker`
- `insertEvents(events)` — `collection('tracks').insertMany(events)`. Errors logged to console, don't crash server.
- `disconnect()` — for graceful shutdown

### Graceful Shutdown

On `SIGINT`/`SIGTERM` — close both Fastify servers and MongoDB connection.

## Build & Config

### package.json scripts

- `build:tracker` — esbuild bundles `src/tracker/tracker.ts` → `dist/tracker.js` (IIFE, globalName: tracker)
- `build:server` — tsc compiles server code
- `build` — both builds in parallel
- `start` — `node dist/server/index.js`
- `dev` — tsx for development without build step
- `format` — `prettier --write .`

### TypeScript

**tsconfig.json** (server): target ES2020, module NodeNext, outDir dist/server, strict true

**tsconfig.tracker.json** (tracker): target ES2020, lib ES2020+DOM (for IDE only; esbuild handles compilation)

### Prettier

`.prettierrc` — empty object `{}` (default config as required by spec).

### .gitignore

`node_modules/`, `dist/`, `.idea/`
