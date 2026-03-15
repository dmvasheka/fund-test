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
// Tracks the in-flight send so that flushBeforeNavigation() can wait
// for it instead of navigating while events are still being delivered.
let activeSend: Promise<void> | null = null;

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
  scheduleFlush();
}

// Normal send: triggered by timer or buffer threshold.
// Retries on network errors and 5xx; drops 422 (invalid data).
async function send(): Promise<void> {
  if (activeSend || buffer.length === 0) return;
  cancelTimer();

  const events = buffer;
  buffer = [];

  activeSend = (async () => {
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
      setTimeout(() => returnToBuffer(events), FLUSH_INTERVAL);
    } finally {
      activeSend = null;
    }
  })();

  await activeSend;
}

function scheduleFlush(): void {
  if (timer || buffer.length === 0) return;
  timer = setTimeout(() => {
    timer = null;
    send();
  }, FLUSH_INTERVAL);
}

export function track(event: string, ...tags: string[]): void {
  buffer.push(createEvent(event, tags));

  if (buffer.length >= FLUSH_THRESHOLD) {
    send();
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

// Pre-navigation send: waits for the in-flight send() to finish,
// then delivers any remaining buffered events before the page navigates.
function shouldInterceptClick(e: MouseEvent, link: HTMLAnchorElement): boolean {
  if (e.defaultPrevented || e.button !== 0) return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (link.target === "_blank" || link.hasAttribute("download")) return false;
  return true;
}

async function sendBeforeNavigation(): Promise<void> {
  if (activeSend) {
    await activeSend;
  }

  if (buffer.length === 0) return;
  cancelTimer();
  const events = buffer;
  buffer = [];
  try {
    await fetch(TRACK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(events),
      keepalive: true,
    });
  } catch {
    // Best effort, navigate regardless
  }
}

document.addEventListener("click", async (e) => {
  const link = (e.target as Element).closest("a");
  if (!link || !link.href || !shouldInterceptClick(e as MouseEvent, link)) {
    return;
  }

  e.preventDefault();
  await sendBeforeNavigation();
  window.location.href = link.href;
});

// Drain queued calls from the async snippet stub
const stub = (window as any).tracker;
if (stub && Array.isArray(stub.q)) {
  for (const args of stub.q) {
    track(args[0] as string, ...(Array.from(args).slice(1) as string[]));
  }
}
