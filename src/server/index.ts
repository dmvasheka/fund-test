import { connect, disconnect } from "./db.js";
import { createSiteServer } from "./site-server.js";
import { createTrackingServer } from "./tracking-server.js";
import { SITE_PORT, TRACKING_PORT } from "./server.config.js";

async function main() {
  await connect();

  const siteServer = createSiteServer();
  const trackingServer = createTrackingServer();

  await siteServer.listen({ port: SITE_PORT });
  console.log(`Site server listening on http://localhost:${SITE_PORT}`);

  await trackingServer.listen({ port: TRACKING_PORT });
  console.log(`Tracking server listening on http://localhost:${TRACKING_PORT}`);

  const shutdown = async () => {
    console.log("Shutting down...");
    await siteServer.close();
    await trackingServer.close();
    await disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
