import Fastify from "fastify";
import { readFileSync } from "fs";
import { join } from "path";
import { VALID_PAGES } from "./pages.config.js";

export function createSiteServer() {
  const app = Fastify();
  const html = readFileSync(join(__dirname, "page.html"), "utf-8");

  app.get("*", (request, reply) => {
    if (!VALID_PAGES.has(request.url)) {
      reply.code(404).send("Not found");
      return;
    }
    reply.type("text/html").send(html);
  });

  return app;
}
