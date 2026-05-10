export interface StoredObject {
  path: string;
  url: string;
  sizeBytes: number;
  contentType: string;
}

export interface StorageDriver {
  putObject(input: {
    path: string;
    bytes: Uint8Array;
    contentType: string;
  }): Promise<StoredObject>;
  getPublicUrl(path: string): string;
}

