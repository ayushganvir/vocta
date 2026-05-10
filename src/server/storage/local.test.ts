import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageDriver, normalizeStoragePath } from "./local";

describe("LocalStorageDriver", () => {
  let root: string;
  let storage: LocalStorageDriver;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vocta-storage-"));
    storage = new LocalStorageDriver(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes, reads, and deletes objects", async () => {
    const bytes = new TextEncoder().encode("hello");
    const stored = await storage.putObject({
      path: "projects/project_1/fake.txt",
      bytes,
      contentType: "text/plain",
      metadata: { jobId: "job_1" }
    });

    expect(stored.path).toBe("projects/project_1/fake.txt");
    expect(stored.url).toBe("/api/storage/local/projects/project_1/fake.txt");
    expect(stored.sizeBytes).toBe(bytes.byteLength);
    expect(stored.etag).toHaveLength(64);
    expect(stored.metadata).toEqual({ jobId: "job_1" });

    const loaded = await storage.getObject(stored.path);
    expect(new TextDecoder().decode(loaded.bytes)).toBe("hello");

    await storage.deleteObject(stored.path);
    await expect(storage.getObject(stored.path)).rejects.toThrow();
  });

  it("normalizes safe relative paths", () => {
    expect(normalizeStoragePath("/projects\\project_1\\asset.png")).toBe("projects/project_1/asset.png");
  });

  it("rejects traversal and empty path segments", async () => {
    expect(() => normalizeStoragePath("../secret.txt")).toThrow("parent");
    await expect(
      storage.putObject({
        path: "projects//asset.txt",
        bytes: new Uint8Array(),
        contentType: "text/plain"
      })
    ).rejects.toThrow("empty");
  });
});
