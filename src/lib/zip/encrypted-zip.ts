import "server-only";

import archiver from "archiver";
import zipEncrypted from "archiver-zip-encrypted";
import { PassThrough } from "node:stream";

let didRegister = false;

function registerEncryptedZipFormat() {
  if (didRegister) return;
  // `archiver-zip-encrypted` plugs into archiver via a custom format name.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  archiver.registerFormat("zip-encrypted", zipEncrypted as any);
  didRegister = true;
}

export type ZipFileInput = {
  buffer: Buffer;
  fileName: string;
};

export async function createEncryptedZipBuffer(files: ZipFileInput[], password: string) {
  registerEncryptedZipFormat();

  const safePassword = password.trim();
  if (!safePassword) {
    throw new Error("ZIP-Passwort fehlt.");
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    // The encrypted zip format uses additional options that are not part of `@types/archiver`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const archive = archiver("zip-encrypted" as any, {
      zlib: { level: 9 },
      encryptionMethod: "aes256",
      password: safePassword,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    archive.on("warning", (error: unknown) => {
      // Archiver emits warnings for e.g. missing stat info; treat as fatal here.
      reject(error instanceof Error ? error : new Error("ZIP konnte nicht erstellt werden."));
    });
    archive.on("error", (error: unknown) => {
      reject(error instanceof Error ? error : new Error("ZIP konnte nicht erstellt werden."));
    });

    const stream = new PassThrough();
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("error", (error) => reject(error));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    archive.pipe(stream);

    files.forEach((file) => {
      archive.append(file.buffer, { name: file.fileName });
    });

    void archive.finalize();
  });
}
