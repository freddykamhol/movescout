import "server-only";

import path from "node:path";

import SftpClient from "ssh2-sftp-client";

import { getIntegrationSecretsForOrg, getIntegrationSettingsForOrg } from "@/lib/integration-settings";

export type SftpConnectionConfig = {
  host: string;
  port: number;
  privateKey: string;
  remoteRoot: string;
  user: string;
  password: string;
};

export async function getSftpConnectionConfigForOrg(orgKey: string): Promise<SftpConnectionConfig | null> {
  const settings = await getIntegrationSettingsForOrg(orgKey);
  const secrets = await getIntegrationSecretsForOrg(orgKey);

  if (!settings || !secrets) return null;
  const host = settings.sftpHost.trim();
  const user = settings.sftpUser.trim();
  const port = settings.sftpPort || 22;
  const remoteRoot = (settings.sftpRemoteRoot || "/movescout/documents").trim();
  const password = secrets.sftpPassword.trim();
  const privateKey = secrets.sftpPrivateKey.trim();

  if (!host || !user || (!password && !privateKey)) return null;

  return {
    host,
    port,
    user,
    remoteRoot,
    password,
    privateKey,
  };
}

export async function withSftpClientForOrg<T>(
  orgKey: string,
  fn: (client: SftpClient, config: SftpConnectionConfig) => Promise<T>,
): Promise<T> {
  const config = await getSftpConnectionConfigForOrg(orgKey);
  if (!config) {
    throw new Error("SFTP ist nicht konfiguriert (Einstellungen → Integrationen).");
  }

  const client = new SftpClient();
  await client.connect({
    host: config.host,
    port: config.port,
    username: config.user,
    password: config.password || undefined,
    privateKey: config.privateKey || undefined,
  });

  try {
    return await fn(client, config);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

export function normalizeRemotePath(value: string) {
  return value.replace(/\\/g, "/");
}

export function joinRemotePath(...parts: string[]) {
  // Use posix joins for SFTP paths.
  return normalizeRemotePath(path.posix.join(...parts));
}

