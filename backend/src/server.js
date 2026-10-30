import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase, disconnectDatabase } from "./models/db.js";
import { startScheduler } from "./modules/jobs/scheduler.js";
import { drainDocumentProcessing } from "./modules/ai/pipeline.js";

let server;
let scheduler;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => process.exit(1), 290000);
  deadline.unref();
  logger.info({ signal }, "Graceful shutdown started");
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await scheduler?.stop();
  await drainDocumentProcessing();
  await disconnectDatabase();
  process.exit(0);
}

try {
  await connectDatabase();
  const app = createApp();
  scheduler = await startScheduler();
  server = app.listen(env.PORT, "0.0.0.0", () => {
    logger.info({ port: env.PORT }, "ApprovalTrack API listening");
  });
  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
} catch (error) {
  logger.fatal({ err: error }, "Server startup failed");
  process.exitCode = 1;
}

export { shutdown };
