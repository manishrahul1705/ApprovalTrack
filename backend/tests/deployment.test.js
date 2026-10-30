import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/env.js", async (original) => ({
  env: { ...(await original()).env, NODE_ENV: "production", PYTHON_BIN: process.execPath, CLAMAV_HOST: "127.0.0.1", UPLOAD_DIR: "./uploads" },
}));
vi.mock("../src/modules/documents/clamav.js", () => ({ scanBuffer: vi.fn() }));
import { scanBuffer } from "../src/modules/documents/clamav.js";
import { createApp } from "../src/app.js";
import { mongoose } from "../src/models/db.js";

afterEach(() => { mongoose.connection.readyState = 0; vi.clearAllMocks(); });

describe("deployment readiness and request origin", () => {
  it("rejects a foreign origin even if the CSRF header is supplied", async () => {
    const result = await request(createApp()).post("/api/v1/auth/login")
      .set("Origin", "https://untrusted.example").set("X-Requested-With", "XMLHttpRequest").send({});
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("CSRF_ORIGIN_REJECTED");
  });

  it("fails readiness when scanning is unavailable and recovers when scanning works", async () => {
    mongoose.connection.readyState = 1;
    scanBuffer.mockRejectedValueOnce(new Error("scanner down"));
    const app = createApp();
    const unavailable = await request(app).get("/health");
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.data.checks.antivirus).toBe("unavailable");
    scanBuffer.mockResolvedValueOnce({ status: "CLEAN" });
    const ready = await request(app).get("/health");
    expect(ready.status).toBe(200);
    expect(ready.body.data.checks.antivirus).toBe("ok");
  });
});
