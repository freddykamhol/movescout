import "server-only";

import { decryptNullableStringForOrg, encryptNullableStringForOrg } from "@/lib/crypto/data-encryption";
import { getCurrentOrgKey } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export type IntegrationSettingsRecord = {
  mailFrom: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  hasSmtpPassword: boolean;
  sftpHost: string;
  sftpPort: number;
  sftpRemoteRoot: string;
  sftpUser: string;
  hasSftpPassword: boolean;
  hasSftpPrivateKey: boolean;
};

function parseBoolean(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseIntSafe(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function ensureIntegrationSettings(orgKey?: string) {
  const prisma = getPrismaClient();
  if (!prisma) return null;

  const resolvedOrgKey = orgKey?.trim() || (await getCurrentOrgKey());
  return prisma.integrationSettings.upsert({
    where: { orgKey: resolvedOrgKey },
    create: { orgKey: resolvedOrgKey },
    update: {},
  });
}

export async function getIntegrationSettingsForOrg(orgKey?: string): Promise<IntegrationSettingsRecord | null> {
  const prisma = getPrismaClient();
  if (!prisma) return null;

  const resolvedOrgKey = orgKey?.trim() || (await getCurrentOrgKey());
  const settings = await ensureIntegrationSettings(resolvedOrgKey);
  if (!settings) return null;

  const smtpHost = decryptNullableStringForOrg(resolvedOrgKey, settings.smtpHostEnc) ?? settings.smtpHost ?? "";
  const smtpPort =
    parseIntSafe(decryptNullableStringForOrg(resolvedOrgKey, settings.smtpPortEnc)) ??
    settings.smtpPort ??
    587;
  const smtpUser = decryptNullableStringForOrg(resolvedOrgKey, settings.smtpUserEnc) ?? settings.smtpUser ?? "";
  const smtpSecure =
    parseBoolean(decryptNullableStringForOrg(resolvedOrgKey, settings.smtpSecureEnc)) ??
    settings.smtpSecure ??
    false;
  const mailFrom = decryptNullableStringForOrg(resolvedOrgKey, settings.mailFromEnc) ?? settings.mailFrom ?? "";

  const sftpHost = decryptNullableStringForOrg(resolvedOrgKey, settings.sftpHostEnc) ?? settings.sftpHost ?? "";
  const sftpPort =
    parseIntSafe(decryptNullableStringForOrg(resolvedOrgKey, settings.sftpPortEnc)) ??
    settings.sftpPort ??
    22;
  const sftpUser = decryptNullableStringForOrg(resolvedOrgKey, settings.sftpUserEnc) ?? settings.sftpUser ?? "";
  const sftpRemoteRoot =
    decryptNullableStringForOrg(resolvedOrgKey, settings.sftpRemoteRootEnc) ??
    settings.sftpRemoteRoot ??
    "/movescout/documents";

  // Best-effort backfill: if legacy plaintext fields exist but encrypted columns are empty, migrate silently.
  try {
    const needsBackfill =
      (!settings.smtpHostEnc && settings.smtpHost) ||
      (!settings.smtpPortEnc && settings.smtpPort) ||
      (!settings.smtpUserEnc && settings.smtpUser) ||
      (!settings.smtpSecureEnc && settings.smtpSecure !== undefined) ||
      (!settings.mailFromEnc && settings.mailFrom) ||
      (!settings.sftpHostEnc && settings.sftpHost) ||
      (!settings.sftpPortEnc && settings.sftpPort) ||
      (!settings.sftpUserEnc && settings.sftpUser) ||
      (!settings.sftpRemoteRootEnc && settings.sftpRemoteRoot);

    if (needsBackfill) {
      await prisma.integrationSettings.update({
        where: { orgKey: resolvedOrgKey },
        data: {
          ...(smtpHost ? { smtpHostEnc: encryptNullableStringForOrg(resolvedOrgKey, smtpHost), smtpHost: null } : { smtpHost: null }),
          ...(smtpUser ? { smtpUserEnc: encryptNullableStringForOrg(resolvedOrgKey, smtpUser), smtpUser: null } : { smtpUser: null }),
          ...(mailFrom ? { mailFromEnc: encryptNullableStringForOrg(resolvedOrgKey, mailFrom), mailFrom: null } : { mailFrom: null }),
          smtpPortEnc: encryptNullableStringForOrg(resolvedOrgKey, String(smtpPort)),
          smtpPort: null,
          smtpSecureEnc: encryptNullableStringForOrg(resolvedOrgKey, smtpSecure ? "1" : "0"),
          smtpSecure: false,
          ...(sftpHost ? { sftpHostEnc: encryptNullableStringForOrg(resolvedOrgKey, sftpHost), sftpHost: null } : { sftpHost: null }),
          ...(sftpUser ? { sftpUserEnc: encryptNullableStringForOrg(resolvedOrgKey, sftpUser), sftpUser: null } : { sftpUser: null }),
          sftpPortEnc: encryptNullableStringForOrg(resolvedOrgKey, String(sftpPort)),
          sftpPort: 22,
          sftpRemoteRootEnc: encryptNullableStringForOrg(resolvedOrgKey, sftpRemoteRoot),
          sftpRemoteRoot: null,
        },
      });
    }
  } catch {
    // ignore backfill errors
  }

  return {
    mailFrom,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    hasSmtpPassword: Boolean(settings.smtpPassEnc),
    sftpHost,
    sftpPort,
    sftpRemoteRoot,
    sftpUser,
    hasSftpPassword: Boolean(settings.sftpPassEnc),
    hasSftpPrivateKey: Boolean(settings.sftpPrivateKeyEnc),
  };
}

export type UpdateIntegrationSettingsPayload = {
  mailFrom?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  clearSmtpPassword?: boolean;
  sftpHost?: string;
  sftpPort?: number;
  sftpUser?: string;
  sftpPassword?: string;
  clearSftpPassword?: boolean;
  sftpPrivateKey?: string;
  clearSftpPrivateKey?: boolean;
  sftpRemoteRoot?: string;
};

export async function updateIntegrationSettingsForOrg(orgKey: string, payload: UpdateIntegrationSettingsPayload) {
  const prisma = getPrismaClient();
  if (!prisma) return null;

  const settings = await ensureIntegrationSettings(orgKey);
  if (!settings) return null;

  return prisma.integrationSettings.update({
    where: { orgKey },
    data: {
      ...(payload.mailFrom !== undefined ? { mailFromEnc: encryptNullableStringForOrg(orgKey, payload.mailFrom), mailFrom: null } : {}),
      ...(payload.smtpHost !== undefined ? { smtpHostEnc: encryptNullableStringForOrg(orgKey, payload.smtpHost), smtpHost: null } : {}),
      ...(payload.smtpPort !== undefined
        ? { smtpPortEnc: encryptNullableStringForOrg(orgKey, String(payload.smtpPort)), smtpPort: null }
        : {}),
      ...(payload.smtpSecure !== undefined
        ? { smtpSecureEnc: encryptNullableStringForOrg(orgKey, payload.smtpSecure ? "1" : "0"), smtpSecure: false }
        : {}),
      ...(payload.smtpUser !== undefined ? { smtpUserEnc: encryptNullableStringForOrg(orgKey, payload.smtpUser), smtpUser: null } : {}),
      ...(payload.clearSmtpPassword ? { smtpPassEnc: null } : {}),
      ...(payload.smtpPassword !== undefined && payload.smtpPassword.trim()
        ? { smtpPassEnc: encryptNullableStringForOrg(orgKey, payload.smtpPassword) }
        : {}),

      ...(payload.sftpHost !== undefined ? { sftpHostEnc: encryptNullableStringForOrg(orgKey, payload.sftpHost), sftpHost: null } : {}),
      ...(payload.sftpPort !== undefined
        ? { sftpPortEnc: encryptNullableStringForOrg(orgKey, String(payload.sftpPort)), sftpPort: 22 }
        : {}),
      ...(payload.sftpUser !== undefined ? { sftpUserEnc: encryptNullableStringForOrg(orgKey, payload.sftpUser), sftpUser: null } : {}),
      ...(payload.sftpRemoteRoot !== undefined
        ? { sftpRemoteRootEnc: encryptNullableStringForOrg(orgKey, payload.sftpRemoteRoot), sftpRemoteRoot: null }
        : {}),
      ...(payload.clearSftpPassword ? { sftpPassEnc: null } : {}),
      ...(payload.sftpPassword !== undefined && payload.sftpPassword.trim()
        ? { sftpPassEnc: encryptNullableStringForOrg(orgKey, payload.sftpPassword) }
        : {}),
      ...(payload.clearSftpPrivateKey ? { sftpPrivateKeyEnc: null } : {}),
      ...(payload.sftpPrivateKey !== undefined && payload.sftpPrivateKey.trim()
        ? { sftpPrivateKeyEnc: encryptNullableStringForOrg(orgKey, payload.sftpPrivateKey) }
        : {}),
    },
  });
}

export async function getIntegrationSecretsForOrg(orgKey: string) {
  const prisma = getPrismaClient();
  if (!prisma) return null;
  const settings = await ensureIntegrationSettings(orgKey);
  if (!settings) return null;

  return {
    smtpPassword: decryptNullableStringForOrg(orgKey, settings.smtpPassEnc) ?? "",
    sftpPassword: decryptNullableStringForOrg(orgKey, settings.sftpPassEnc) ?? "",
    sftpPrivateKey: decryptNullableStringForOrg(orgKey, settings.sftpPrivateKeyEnc) ?? "",
  };
}
