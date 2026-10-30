import { spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("serves explicit storage maintenance without MongoDB and fails readiness when scanning fails", async () => {
  let clean = true;
  const scanner = net.createServer(socket => {
    let bytes = Buffer.alloc(0);
    let answered = false;
    socket.on("data", chunk => {
      bytes = Buffer.concat([bytes, chunk]);
      if (!answered && bytes.length > 14 && bytes.subarray(-4).equals(Buffer.alloc(4))) {
        answered = true;
        socket.end(clean ? "stream: OK\0" : "stream: ERROR\0");
      }
    });
  });
  const portReservation = net.createServer();
  const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  await listen(scanner);
  await listen(portReservation);
  const port = portReservation.address().port;
  await new Promise(resolve => portReservation.close(resolve));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "approvaltrack-maintenance-"));
  const child = spawn(process.execPath, [fileURLToPath(new URL("../../deploy/maintenance.mjs", import.meta.url))], {
    env: { ...process.env, NODE_ENV: "production", COOKIE_SECRET: "synthetic-maintenance-test-secret-00000000", MONGODB_URI: "mongodb://127.0.0.1:1/approvaltrack", CLAMAV_HOST: "127.0.0.1", CLAMAV_PORT: String(scanner.address().port), PORT: String(port), UPLOAD_DIR: root },
    stdio: "ignore",
  });
  try {
    let response;
    for (let i = 0; i < 50; i++) {
      try { response = await fetch(`http://127.0.0.1:${port}/health`); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    expect(response?.status).toBe(200);
    expect(await response.json()).toEqual({ status: "storage-maintenance", applicationReady: false });
    expect((await fetch(`http://127.0.0.1:${port}/api/v1/auth/me`)).status).toBe(503);
    clean = false;
    expect((await fetch(`http://127.0.0.1:${port}/health`)).status).toBe(503);
  } finally {
    child.kill();
    await new Promise(resolve => child.exitCode !== null ? resolve() : child.once("exit", resolve));
    await new Promise(resolve => scanner.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  }
}, 10000);
