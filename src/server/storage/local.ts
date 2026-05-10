import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readEnv } from "@/lib/env";
import type { StorageDriver, StoredObject } from "./types";

export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly root = readEnv().LOCAL_STORAGE_ROOT) {}

  async putObject(input: {
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<StoredObject> {
    const fullPath = join(this.root, input.path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.bytes);

    return {
      path: input.path,
      url: this.getPublicUrl(input.path),
      sizeBytes: input.bytes.byteLength,
      contentType: input.contentType
    };
  }

  getPublicUrl(path: string): string {
    return `/api/storage/local/${encodeURIComponent(path)}`;
  }
}

