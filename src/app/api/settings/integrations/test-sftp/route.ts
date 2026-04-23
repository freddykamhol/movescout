import { NextResponse } from "next/server";

import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getIntegrationSecretsForOrg, getIntegrationSettingsForOrg } from "@/lib/integration-settings";
import SftpClient from "ssh2-sftp-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const settings = await getIntegrationSettingsForOrg(orgKey);
  const secrets = await getIntegrationSecretsForOrg(orgKey);

  if (!settings || !secrets || !settings.sftpHost || !settings.sftpUser) {
    return NextResponse.json({ message: "SFTP ist nicht konfiguriert." }, { status: 422 });
  }

  const port = settings.sftpPort || 22;
  const remoteRoot = settings.sftpRemoteRoot || "/movescout/documents";
  const password = secrets.sftpPassword.trim();
  const privateKey = secrets.sftpPrivateKey.trim();

  if (!password && !privateKey) {
    return NextResponse.json({ message: "SFTP braucht Passwort oder Private Key." }, { status: 422 });
  }

  const client = new SftpClient();

  try {
    await client.connect({
      host: settings.sftpHost,
      port,
      username: settings.sftpUser,
      password: password || undefined,
      privateKey: privateKey || undefined,
    });

    await client.mkdir(remoteRoot, true);
    await client.list(remoteRoot);
    await client.end();

    return NextResponse.json({ message: "SFTP Verbindung erfolgreich." });
  } catch (error) {
    try {
      await client.end();
    } catch {
      // ignore
    }
    const isDev = process.env.NODE_ENV !== "production";
    const message =
      isDev && error instanceof Error ? `SFTP Test fehlgeschlagen: ${error.message}` : "SFTP Test fehlgeschlagen.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

