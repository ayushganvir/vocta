export type ZipEntry = {
  path: string;
  bytes: Uint8Array;
  modifiedAt?: Date;
};

const crcTable = createCrcTable();

export function createUncompressedZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(normalizeZipPath(entry.path), "utf8");
    const bytes = Buffer.from(entry.bytes);
    const crc = crc32(bytes);
    const { dosTime, dosDate } = toDosDateTime(entry.modifiedAt ?? new Date());
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(bytes.byteLength, 18);
    localHeader.writeUInt32LE(bytes.byteLength, 22);
    localHeader.writeUInt16LE(fileName.byteLength, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileName, bytes);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(bytes.byteLength, 20);
    centralHeader.writeUInt32LE(bytes.byteLength, 24);
    centralHeader.writeUInt16LE(fileName.byteLength, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileName);
    offset += localHeader.byteLength + fileName.byteLength + bytes.byteLength;
  }

  const centralOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);

  return new Uint8Array(Buffer.concat([...localParts, centralDirectory, end]));
}

function normalizeZipPath(path: string) {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");

  if (!normalized || normalized.includes("\0") || normalized.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`Invalid ZIP path: ${path}`);
  }

  return normalized;
}

function toDosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());

  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]!;
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function createCrcTable() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
}
