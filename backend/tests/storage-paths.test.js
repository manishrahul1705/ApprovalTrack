import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const driver = vi.hoisted(() => ({ current: "C:\\old\\uploads\\file.pdf", updates: [], backup: "", closed: false }));
vi.mock("mongoose", () => ({ default: { mongo: {
  ObjectId: class { constructor(value) { this.value = value; } },
  MongoClient: class {
    async connect() {}
    db() { return { databaseName: "approvaltrack", collection: () => ({
      findOne: async () => ({ file_path: driver.current }),
      updateOne: async (filter, update) => {
        // This assertion is inside the fake database write: backup must already exist.
        const backup = JSON.parse(await fs.readFile(driver.backup, "utf8"));
        expect(backup.rows[0].before).toBe(driver.current);
        expect(filter.file_path).toBe(driver.current);
        driver.updates.push(update);
        return { modifiedCount: 1 };
      },
    }) }; }
    async close() { driver.closed = true; }
  },
} } }));

let directory;
let argv;
beforeEach(async () => {
  vi.resetModules();
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "approvaltrack-path-test-"));
  argv = process.argv;
  driver.current = "C:\\old\\uploads\\file.pdf";
  driver.updates = [];
  driver.backup = path.join(directory, "backup.json");
  driver.closed = false;
  vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1/approvaltrack");
  vi.stubEnv("UPLOAD_DIR", directory);
});
afterEach(async () => {
  process.argv = argv;
  vi.unstubAllEnvs();
  await fs.rm(directory, { recursive: true, force: true });
});

async function run(after = "file.pdf", sha256) {
  const bytes = Buffer.from("synthetic migration test");
  await fs.writeFile(path.join(directory, "file.pdf"), bytes);
  const plan = path.join(directory, "plan.json");
  await fs.writeFile(plan, JSON.stringify({ database: "approvaltrack", rows: [{
    collection: "documents", id: "507f1f77bcf86cd799439011", field: "file_path",
    before: "C:\\old\\uploads\\file.pdf", after,
    sha256: sha256 ?? crypto.createHash("sha256").update(bytes).digest("hex"),
  }] }));
  process.argv = [process.execPath, "storage-paths.mjs", "apply", driver.backup, plan];
  return import("../scripts/storage-paths.mjs");
}

describe("storage path migration safeguards with an in-memory driver", () => {
  it("backs up before a compare-and-set path write", async () => {
    await run();
    expect(driver.updates).toEqual([{ $set: { file_path: "file.pdf" } }]);
    expect(driver.closed).toBe(true);
  });
  it("refuses a missing or incorrect target hash before any write or backup", async () => {
    await expect(run("file.pdf", "wrong")).rejects.toThrow("SHA256");
    expect(driver.updates).toHaveLength(0);
    await expect(fs.access(driver.backup)).rejects.toThrow();
    expect(driver.closed).toBe(true);
  });
  it("refuses traversal before any database write", async () => {
    await expect(run("../escape.pdf")).rejects.toThrow("Invalid path change");
    expect(driver.updates).toHaveLength(0);
  });
  it("refuses changed records before writing a backup or modifying paths", async () => {
    driver.current = "newer-file.pdf";
    await expect(run()).rejects.toThrow("Record changed");
    expect(driver.updates).toHaveLength(0);
    await expect(fs.access(driver.backup)).rejects.toThrow();
  });
});
