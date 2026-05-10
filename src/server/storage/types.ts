export interface StoredObject {
  path: string;
  url: string;
  sizeBytes: number;
  contentType: string;
  etag: string;
  metadata?: Record<string, string>;
}

export interface StorageDriver {
  putObject(input: {
    path: string;
    bytes: Uint8Array;
    contentType: string;
    metadata?: Record<string, string>;
  }): Promise<StoredObject>;
  getObject(path: string): Promise<{
    path: string;
    bytes: Uint8Array;
    contentType?: string;
  }>;
  deleteObject(path: string): Promise<void>;
  getPublicUrl(path: string): string;
}
