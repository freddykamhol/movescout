import "server-only";

import path from "node:path";

import { joinRemotePath, withSftpClientForOrg } from "@/lib/storage/sftp";
import { getSftpConnectionConfigForOrg } from "@/lib/storage/sftp";

export type StoredDocumentFile = {
  fileName: string;
  relativePath: string;
  title: string;
  updatedAt: string;
};

const customerDocumentsFolderName = "Kundendokumente";
const customerMovesFolderName = "Umzuege";
const moveDocumentsFolderName = "Umzugsbezogen";
const organizationsFolderName = "Organisationen";
const brandingFolderName = "_branding";

function getDefaultOrgKey() {
  return process.env.MOVESCOUT_DEFAULT_ORG_KEY?.trim() || "org_default";
}

function resolveOrgKey(orgKey: string | undefined) {
  return orgKey?.trim() || getDefaultOrgKey();
}

export function sanitizeStoragePathSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "Unbekannt";
}

function normalizeRelativePath(relativePath: string) {
  const normalizedRelativePath = relativePath
    .split(/[\\/]+/)
    .filter(Boolean)
    .filter((segment) => segment !== "." && segment !== "..")
    .join(path.posix.sep);

  return normalizedRelativePath;
}

function formatFileDate(updatedAt: Date) {
  return updatedAt.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function hasSftpBackend(orgKey: string) {
  const config = await getSftpConnectionConfigForOrg(orgKey);
  return Boolean(config);
}

async function listFilesSftp(orgKey: string, folderPath: string, relativeBasePath: string): Promise<StoredDocumentFile[]> {
  try {
    return await withSftpClientForOrg(orgKey, async (client) => {
      await client.mkdir(folderPath, true);
      const entries = await client.list(folderPath);
      const files = (entries ?? [])
        .map((entry) => entry as { name?: string; type?: string; modifyTime?: number })
        .filter((entry) => Boolean(entry.name))
        .filter((entry) => entry.type === "-" || entry.type === "l" || entry.type === "file" || entry.type === undefined)
        .map((entry) => {
          const updatedAtTimestamp = typeof entry.modifyTime === "number" ? entry.modifyTime : 0;
          const updatedAt = updatedAtTimestamp ? new Date(updatedAtTimestamp) : new Date();
          return {
            fileName: String(entry.name),
            relativePath: path.posix.join(relativeBasePath, String(entry.name)).replace(/\\/g, "/"),
            title: String(entry.name).replace(/\.[^.]+$/, ""),
            updatedAt: formatFileDate(updatedAt),
            updatedAtTimestamp,
          };
        })
        .sort((left, right) => right.updatedAtTimestamp - left.updatedAtTimestamp)
        .map((file) => ({
          fileName: file.fileName,
          relativePath: file.relativePath,
          title: file.title,
          updatedAt: file.updatedAt,
        }));
      return files;
    });
  } catch {
    return [];
  }
}

async function getOrgRootRemote(orgKey: string) {
  const config = await getSftpConnectionConfigForOrg(orgKey);
  if (!config) {
    throw new Error("SFTP ist nicht konfiguriert (Einstellungen → Integrationen).");
  }

  return joinRemotePath(config.remoteRoot, organizationsFolderName, sanitizeStoragePathSegment(resolveOrgKey(orgKey)));
}

export function getCustomerDocumentsFolderRelativePath(customerNumber: string) {
  return path.posix.join("Kunden", sanitizeStoragePathSegment(customerNumber), customerDocumentsFolderName);
}

export function getCustomerMovesFolderRelativePath(customerNumber: string) {
  return path.posix.join("Kunden", sanitizeStoragePathSegment(customerNumber), customerMovesFolderName);
}

export function getMoveDocumentsFolderRelativePath(customerNumber: string, moveNumber: string) {
  return path.posix.join(
    "Kunden",
    sanitizeStoragePathSegment(customerNumber),
    customerMovesFolderName,
    sanitizeStoragePathSegment(moveNumber),
    moveDocumentsFolderName,
  );
}

export async function ensureCustomerDocumentStructure(customerNumber: string, orgKey?: string) {
  const resolvedOrgKey = resolveOrgKey(orgKey);
  const sftpEnabled = await hasSftpBackend(resolvedOrgKey);

  if (!sftpEnabled) {
    throw new Error("SFTP ist nicht konfiguriert (Einstellungen → Integrationen).");
  }

  const orgRootRemote = await getOrgRootRemote(resolvedOrgKey);
  const customerFolderPath = joinRemotePath(orgRootRemote, "Kunden", sanitizeStoragePathSegment(customerNumber));
  const customerDocumentsFolderPath = joinRemotePath(customerFolderPath, customerDocumentsFolderName);
  const customerMovesFolderPath = joinRemotePath(customerFolderPath, customerMovesFolderName);

  await withSftpClientForOrg(resolvedOrgKey, async (client) => {
    await client.mkdir(customerDocumentsFolderPath, true);
    await client.mkdir(customerMovesFolderPath, true);
  });

  return {
    customerDocumentsFolderPath,
    customerFolderPath,
    customerMovesFolderPath,
  };
}

export async function ensureMoveDocumentStructure(customerNumber: string, moveNumber: string, orgKey?: string) {
  const resolvedOrgKey = resolveOrgKey(orgKey);
  const { customerMovesFolderPath } = await ensureCustomerDocumentStructure(customerNumber, resolvedOrgKey);
  const moveDocumentsFolderPath = joinRemotePath(
    customerMovesFolderPath,
    sanitizeStoragePathSegment(moveNumber),
    moveDocumentsFolderName,
  );

  const sftpEnabled = await hasSftpBackend(resolvedOrgKey);
  if (!sftpEnabled) {
    throw new Error("SFTP ist nicht konfiguriert (Einstellungen → Integrationen).");
  }

  await withSftpClientForOrg(resolvedOrgKey, async (client) => {
    await client.mkdir(moveDocumentsFolderPath, true);
  });

  return {
    moveDocumentsFolderPath,
    moveFolderPath: path.posix.dirname(moveDocumentsFolderPath),
  };
}

export async function ensureOrganizationBrandingFolder(orgKey: string) {
  const resolvedOrgKey = resolveOrgKey(orgKey);
  const sftpEnabled = await hasSftpBackend(resolvedOrgKey);
  if (!sftpEnabled) {
    throw new Error("SFTP ist nicht konfiguriert (Einstellungen → Integrationen).");
  }

  const orgRootRemote = await getOrgRootRemote(resolvedOrgKey);
  const folderPath = joinRemotePath(orgRootRemote, brandingFolderName);
  await withSftpClientForOrg(resolvedOrgKey, async (client) => {
    await client.mkdir(folderPath, true);
  });

  return {
    brandingFolderPath: folderPath,
    relativeBrandingFolderPath: brandingFolderName,
  };
}

export async function renameCustomerDocumentStructure(previousCustomerNumber: string, nextCustomerNumber: string, orgKey?: string) {
  const resolvedOrgKey = resolveOrgKey(orgKey);
  if (previousCustomerNumber === nextCustomerNumber) {
    return ensureCustomerDocumentStructure(nextCustomerNumber, resolvedOrgKey);
  }

  const sftpEnabled = await hasSftpBackend(resolvedOrgKey);
  if (!sftpEnabled) {
    throw new Error("SFTP ist nicht konfiguriert (Einstellungen → Integrationen).");
  }

  const orgRootRemote = await getOrgRootRemote(resolvedOrgKey);
  const previousFolderPath = joinRemotePath(orgRootRemote, "Kunden", sanitizeStoragePathSegment(previousCustomerNumber));
  const nextFolderPath = joinRemotePath(orgRootRemote, "Kunden", sanitizeStoragePathSegment(nextCustomerNumber));

  await withSftpClientForOrg(resolvedOrgKey, async (client) => {
    const previousExists = await client.exists(previousFolderPath);
    const nextExists = await client.exists(nextFolderPath);
    if (previousExists && !nextExists) {
      await client.mkdir(path.posix.dirname(nextFolderPath), true);
      await client.rename(previousFolderPath, nextFolderPath);
    }
  });

  return ensureCustomerDocumentStructure(nextCustomerNumber, resolvedOrgKey);
}

export async function listCustomerDocumentFiles(customerNumber: string, orgKey?: string) {
  const resolvedOrgKey = resolveOrgKey(orgKey);
  await ensureCustomerDocumentStructure(customerNumber, resolvedOrgKey);

  const sftpEnabled = await hasSftpBackend(resolvedOrgKey);
  if (!sftpEnabled) {
    throw new Error("SFTP ist nicht konfiguriert (Einstellungen → Integrationen).");
  }

  const orgRootRemote = await getOrgRootRemote(resolvedOrgKey);
  const remoteFolder = joinRemotePath(
    orgRootRemote,
    "Kunden",
    sanitizeStoragePathSegment(customerNumber),
    customerDocumentsFolderName,
  );
  const relativeBase = path.posix.join("Kunden", sanitizeStoragePathSegment(customerNumber), customerDocumentsFolderName);
  return listFilesSftp(resolvedOrgKey, remoteFolder, relativeBase);
}

export async function listMoveDocumentFiles(customerNumber: string, moveNumber: string, orgKey?: string) {
  const resolvedOrgKey = resolveOrgKey(orgKey);
  await ensureMoveDocumentStructure(customerNumber, moveNumber, resolvedOrgKey);

  const sftpEnabled = await hasSftpBackend(resolvedOrgKey);
  if (!sftpEnabled) {
    throw new Error("SFTP ist nicht konfiguriert (Einstellungen → Integrationen).");
  }

  const orgRootRemote = await getOrgRootRemote(resolvedOrgKey);
  const remoteFolder = joinRemotePath(
    orgRootRemote,
    "Kunden",
    sanitizeStoragePathSegment(customerNumber),
    customerMovesFolderName,
    sanitizeStoragePathSegment(moveNumber),
    moveDocumentsFolderName,
  );
  const relativeBase = path.posix.join(
    "Kunden",
    sanitizeStoragePathSegment(customerNumber),
    customerMovesFolderName,
    sanitizeStoragePathSegment(moveNumber),
    moveDocumentsFolderName,
  );
  return listFilesSftp(resolvedOrgKey, remoteFolder, relativeBase);
}

async function resolveAbsoluteDocumentPathForOrg(orgKey: string, relativePath: string) {
  const resolvedOrgKey = resolveOrgKey(orgKey);
  const sanitizedRelative = normalizeRelativePath(relativePath);
  const sftpEnabled = await hasSftpBackend(resolvedOrgKey);

  if (!sftpEnabled) {
    return null;
  }

  const orgRootRemote = await getOrgRootRemote(resolvedOrgKey);
  const rootPath = path.posix.resolve(orgRootRemote);
  const absolutePath = path.posix.resolve(rootPath, sanitizedRelative);
  if (absolutePath !== rootPath && !absolutePath.startsWith(`${rootPath}/`)) {
    return null;
  }
  return { backend: "sftp" as const, absolutePath, relativePath: sanitizedRelative };
}

async function bufferFromUnknown(data: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data);
  if (data && typeof data === "object" && "pipe" in (data as Record<string, unknown>)) {
    const stream = data as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on("end", () => resolve());
      stream.on("error", (err) => reject(err));
    });
    return Buffer.concat(chunks);
  }
  return Buffer.from([]);
}

export async function readStoredDocumentFileForOrg(orgKey: string, relativePath: string) {
  const resolved = await resolveAbsoluteDocumentPathForOrg(orgKey, relativePath);
  if (!resolved) return null;

  try {
    return await withSftpClientForOrg(orgKey, async (client) => {
      const exists = await client.exists(resolved.absolutePath);
      if (!exists) return null;
      const data = await client.get(resolved.absolutePath);
      const buffer = await bufferFromUnknown(data);
      return { buffer, fileName: path.posix.basename(resolved.absolutePath), size: buffer.length };
    });
  } catch {
    return null;
  }
}

export async function deleteStoredDocumentFileForOrg(orgKey: string, relativePath: string) {
  const resolved = await resolveAbsoluteDocumentPathForOrg(orgKey, relativePath);
  if (!resolved) return { ok: false as const, status: 400 as const };

  try {
    return await withSftpClientForOrg(orgKey, async (client) => {
      const exists = await client.exists(resolved.absolutePath);
      if (!exists) return { ok: false as const, status: 404 as const };
      await client.delete(resolved.absolutePath);
      return { ok: true as const };
    });
  } catch {
    return { ok: false as const, status: 500 as const };
  }
}

export async function renameStoredDocumentFileForOrg(orgKey: string, relativePath: string, nextFileName: string) {
  const resolved = await resolveAbsoluteDocumentPathForOrg(orgKey, relativePath);
  if (!resolved) return null;

  const safeName = path.posix.basename(nextFileName.trim());
  const folderRelative = path.posix.dirname(resolved.relativePath);
  const nextRelativePath = path.posix.join(folderRelative === "." ? "" : folderRelative, safeName).replace(/\\/g, "/");
  const nextResolved = await resolveAbsoluteDocumentPathForOrg(orgKey, nextRelativePath);
  if (!nextResolved) return null;

  try {
    return await withSftpClientForOrg(orgKey, async (client) => {
      const exists = await client.exists(resolved.absolutePath);
      if (!exists) return null;
      await client.rename(resolved.absolutePath, nextResolved.absolutePath);
      return { relativePath: nextRelativePath, fileName: safeName };
    });
  } catch {
    return null;
  }
}

export async function writeStoredDocumentFileForOrg(orgKey: string, relativePath: string, buffer: Buffer) {
  const resolved = await resolveAbsoluteDocumentPathForOrg(orgKey, relativePath);
  if (!resolved) return false;

  return withSftpClientForOrg(orgKey, async (client) => {
    await client.mkdir(path.posix.dirname(resolved.absolutePath), true);
    await client.put(buffer, resolved.absolutePath);
    return true;
  });
}

export async function writeStoredDocumentFileUniqueForOrg(orgKey: string, folderRelativePath: string, incomingFileName: string, buffer: Buffer) {
  const normalizedFolderRelative = normalizeRelativePath(folderRelativePath);
  const baseName = path.posix.basename(incomingFileName.trim()) || "Dokument";
  const extension = path.posix.extname(baseName);
  const stem = extension ? baseName.slice(0, -extension.length) : baseName;

  async function pickUnique(existing: Set<string>) {
    let candidate = baseName;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (!existing.has(candidate)) return candidate;
      candidate = `${stem}-${attempt + 1}${extension}`;
    }
    return `${stem}-${Date.now()}${extension}`;
  }

  const sftpEnabled = await hasSftpBackend(resolveOrgKey(orgKey));
  if (!sftpEnabled) {
    throw new Error("SFTP ist nicht konfiguriert (Einstellungen → Integrationen).");
  }

  const orgRootRemote = await getOrgRootRemote(orgKey);
  const folderAbs = joinRemotePath(orgRootRemote, normalizedFolderRelative);
  return withSftpClientForOrg(orgKey, async (client) => {
    await client.mkdir(folderAbs, true);
    const entries = await client.list(folderAbs);
    const existingSet = new Set((entries ?? []).map((entry) => String((entry as { name?: string }).name ?? "")).filter(Boolean));
    const uniqueName = await pickUnique(existingSet);
    const nextRelative = path.posix.join(normalizedFolderRelative, uniqueName);
    const nextAbs = joinRemotePath(folderAbs, uniqueName);
    await client.put(buffer, nextAbs);
    return { relativePath: nextRelative, fileName: uniqueName };
  });
}
