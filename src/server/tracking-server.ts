import Fastify from "fastify";
import { readFileSync } from "fs";
import { join } from "path";
import { insertEvents } from "./db.js";

interface TrackEvent {
  [key: string]: unknown;
  event: string;
  tags: string[];
  url: string;
  title: string;
  ts: number;
}

const ALLOWED_KEYS = new Set(["event", "tags", "url", "title", "ts"]);

function isValidEvent(item: unknown): item is TrackEvent {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;

  const keys = Object.keys(obj);
  if (
    keys.length !== ALLOWED_KEYS.size ||
    !keys.every((k) => ALLOWED_KEYS.has(k))
  ) {
    return false;
  }

  return (
    typeof obj.event === "string" &&
    obj.event.length > 0 &&
    Array.isArray(obj.tags) &&
    obj.tags.every((t: unknown) => typeof t === "string") &&
    typeof obj.url === "string" &&
    obj.url.length > 0 &&
    typeof obj.title === "string" &&
    typeof obj.ts === "number" &&
    obj.ts > 0
  );
}

function isValidPayload(body: unknown): body is TrackEvent[] {
  return Array.isArray(body) && body.length > 0 && body.every(isValidEvent);
}

export function createTrackingServer() {
  const app = Fastify();

  // Parse text/plain as JSON (avoids CORS preflight)
  app.addContentTypeParser(
    "text/plain",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch {
        // Pass null so isValidPayload() rejects it as 422, not Fastify's default 400
        done(null, null);
      }
    },
  );

  // CORS headers
  app.addHook("onSend", (_request, reply, _payload, done) => {
    reply.header("Access-Control-Allow-Origin", "*");
    done();
  });

  const trackerPath = join(__dirname, "..", "tracker.js");
  const trackerJs = readFileSync(trackerPath, "utf-8");

  app.get("/tracker", (_request, reply) => {
    reply.type("application/javascript").send(trackerJs);
  });

  app.post("/track", (request, reply) => {
    if (!isValidPayload(request.body)) {
      reply.code(422).send();
      return;
    }

    reply.code(200).send();

    // Fire-and-forget: respond before DB insert (per spec)
    insertEvents(request.body);
  });

  return app;
}
