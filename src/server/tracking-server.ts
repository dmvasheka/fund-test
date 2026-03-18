import Fastify from "fastify";
import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { insertEvents } from "./db.js";

const TrackEventSchema = z
  .object({
    event: z.string().min(1),
    tags: z.array(z.string()),
    url: z.string().min(1),
    title: z.string(),
    ts: z.number().positive(),
  })
  .strict();

const TrackEventsSchema = z.array(TrackEventSchema).min(1);

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

  const trackerPath = join(process.cwd(), "dist", "tracker.js");
  const trackerJs = readFileSync(trackerPath, "utf-8");

  app.get("/tracker", (_request, reply) => {
    reply.type("application/javascript").send(trackerJs);
  });

  app.post("/track", (request, reply) => {
    const parsed = TrackEventsSchema.safeParse(request.body);

    if (!parsed.success) {
      reply.code(422).send();
      return;
    }

    reply.code(200).send();

    // Fire-and-forget: respond before DB insert (per spec)
    insertEvents(parsed.data);
  });

  return app;
}
