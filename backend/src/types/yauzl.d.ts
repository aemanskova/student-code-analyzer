declare module "yauzl" {
  import { Readable } from "node:stream";

  export class Entry {
    fileName: string;
    uncompressedSize: number;
  }

  export class ZipFile {
    entryCount: number;
    readEntry(): void;
    close(): void;
    openReadStream(entry: Entry, callback: (error: Error | null, stream: Readable) => void): void;
    on(event: "entry", listener: (entry: Entry) => void): this;
    on(event: "end", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
  }

  export abstract class RandomAccessReader {
    ref(): void;
    unref(): void;
    createReadStream(options: { start: number; end: number }): Readable;
  }

  export function fromRandomAccessReader(
    reader: RandomAccessReader,
    totalSize: number,
    options: {
      lazyEntries?: boolean;
      strictFileNames?: boolean;
      validateEntrySizes?: boolean;
    },
    callback: (error: Error | null, zipFile: ZipFile) => void
  ): void;
}
