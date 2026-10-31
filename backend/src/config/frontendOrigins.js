import { env } from "./env.js";

export const allowedOrigins = new Set([
  new URL(env.FRONTEND_ORIGIN).origin,
  "https://approval-track-theta.vercel.app",
  "https://aprovaltrack.automconsultancy.in",
]);
