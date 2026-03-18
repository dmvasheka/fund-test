interface TrackEvent {
  event: string;
  tags: string[];
  url: string;
  title: string;
  ts: number;
}

const TRACK_URL = "http://localhost:8888/track";
const FLUSH_INTERVAL = 1000;
const FLUSH_THRESHOLD = 3;

let buffer: TrackEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSendAt = 0;

function createEvent(event: string, tags: string[]): TrackEvent {
  return {
    event,
    tags,
    url: location.href,
    title: document.title,
    ts: Math.floor(Date.now() / 1000),
  };
}

function cancelTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function returnToBuffer(events: TrackEvent[]): void {
  buffer = events.concat(buffer);
}

// Normal send: triggered by timer or buffer threshold.
// Retries on network errors and 5xx; drops 422 (invalid data).
async function send(): Promise<void> {
  if (buffer.length === 0) return;
  cancelTimer();

  const events = buffer;
  buffer = [];
  lastSendAt = Date.now();

  let sendPromise: Promise<void>;

  sendPromise = (async () => {
    try {
      const response = await fetch(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(events),
        keepalive: true,
      });
      if (response.status >= 500) {
        throw new Error(`Server error ${response.status}`);
      }
    } catch {
      setTimeout(() => {
        returnToBuffer(events);
        void send();
      }, FLUSH_INTERVAL);
    }
  })();

  await sendPromise;
}

function scheduleFlush(): void {
  if (timer || buffer.length === 0) return;

  const delay = Math.max(0, lastSendAt + FLUSH_INTERVAL - Date.now());
  if (delay === 0) {
    void send();
    return;
  }

  timer = setTimeout(() => {
    timer = null;
    void send();
  }, delay);
}

export function track(event: string, ...tags: string[]): void {
  buffer.push(createEvent(event, tags));

  if (buffer.length >= FLUSH_THRESHOLD) {
    void send();
  } else {
    scheduleFlush();
  }
}

// Page unload send: best-effort via sendBeacon (fire-and-forget).
// No retry, the page is going away, so the buffer would be lost anyway.
function sendOnUnload(): void {
  if (buffer.length === 0) return;
  cancelTimer();
  const events = buffer;
  buffer = [];
  const data = JSON.stringify(events);
  if (!navigator.sendBeacon(TRACK_URL, data)) {
    fetch(TRACK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: data,
      keepalive: true,
    }).catch(() => {});
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    sendOnUnload();
  }
});

// Drain queued calls from the async snippet stub
const stub = (window as any).tracker;
if (stub && Array.isArray(stub.q)) {
  for (const args of stub.q) {
    track(args[0] as string, ...(Array.from(args).slice(1) as string[]));
  }
}
