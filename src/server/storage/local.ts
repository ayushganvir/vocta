import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { readEnv } from "@/lib/env";
import type { StorageDriver, StoredObject } from "./types";

function normalizeStoragePath(path: string) {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");

  if (!normalized || normalized.includes("\0") || isAbsolute(normalized)) {
    throw new Error("Storage path must be a relative path.");
  }

  const parts = normalized.split("/");

  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Storage path cannot contain empty, current, or parent segments.");
  }

  return parts.join("/");
}

function assertInsideRoot(root: string, fullPath: string) {
  const rootPath = resolve(root);
  const resolvedPath = resolve(fullPath);
  const rel = relative(rootPath, resolvedPath);

  if (rel.startsWith("..") || rel === ".." || isAbsolute(rel)) {
    throw new Error("Storage path escapes the local storage root.");
  }
}

function buildEtag(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export class LocalStorageDriver implements StorageDriver {
  private readonly rootPath: string;

  constructor(root = readEnv().LOCAL_STORAGE_ROOT) {
    this.rootPath = resolve(root);
  }

  private getFullPath(path: string) {
    const storagePath = normalizeStoragePath(path);
    const fullPath = resolve(this.rootPath, storagePath.split("/").join(sep));
    assertInsideRoot(this.rootPath, fullPath);
    return { storagePath, fullPath };
  }

  async putObject(input: {
    path: string;
    bytes: Uint8Array;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<StoredObject> {
    const { storagePath, fullPath } = this.getFullPath(input.path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.bytes);

    return {
      path: storagePath,
      url: this.getPublicUrl(storagePath),
      sizeBytes: input.bytes.byteLength,
      contentType: input.contentType,
      etag: buildEtag(input.bytes),
      metadata: input.metadata
    };
  }

  async getObject(path: string) {
    const { storagePath, fullPath } = this.getFullPath(path);
    const bytes = await readFile(fullPath);

    return {
      path: storagePath,
      bytes: new Uint8Array(bytes)
    };
  }

  async deleteObject(path: string) {
    const { fullPath } = this.getFullPath(path);
    await rm(fullPath, { force: true });
  }

  getPublicUrl(path: string): string {
    const storagePath = normalizeStoragePath(path);
    return `/api/storage/local/${storagePath.split("/").map(encodeURIComponent).join("/")}`;
  }
}

export { normalizeStoragePath };
