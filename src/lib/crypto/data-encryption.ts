import "server-only";

import crypto from "node:crypto";

const encryptionPrefix = "enc:v1:";

function getMasterKey() {
  const raw = process.env.MOVESCOUT_DATA_ENCRYPTION_KEY?.trim() || "";
  if (!raw) {
    if (process.env.NODE_ENV !== "production") {
      // Dev fallback so the app still runs without extra setup.
      return crypto.createHash("sha256").update("movescout-dev-encryption-key").digest();
    }
    throw new Error("MOVESCOUT_DATA_ENCRYPTION_KEY fehlt.");
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    throw new Error("MOVESCOUT_DATA_ENCRYPTION_KEY muss base64 sein.");
  }

  if (key.length < 32) {
    throw new Error("MOVESCOUT_DATA_ENCRYPTION_KEY ist zu kurz (mindestens 32 Bytes base64).");
  }

  return key.length === 32 ? key : crypto.createHash("sha256").update(key).digest();
}

function deriveOrgKey(orgKey: string) {
  const masterKey = getMasterKey();
  const salt = Buffer.from("movescout-data-v1", "utf8");
  const info = Buffer.from(orgKey.trim() || "org_default", "utf8");
  return Buffer.from(crypto.hkdfSync("sha256", masterKey, salt, info, 32));
}

export function encryptStringForOrg(orgKey: string, plaintext: string) {
  const value = plaintext ?? "";
  if (!value) return value;
  if (value.startsWith(encryptionPrefix)) return value;

  const key = deriveOrgKey(orgKey);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${encryptionPrefix}${iv.toString("base64")}:${ciphertext.toString("base64")}:${tag.toString("base64")}`;
}

export function decryptStringForOrg(orgKey: string, value: string) {
  const raw = value ?? "";
  if (!raw) return raw;
  if (!raw.startsWith(encryptionPrefix)) return raw;

  const payload = raw.slice(encryptionPrefix.length);
  const parts = payload.split(":");
  if (parts.length !== 3) return "";
  const [ivB64, ciphertextB64, tagB64] = parts;

  try {
    const key = deriveOrgKey(orgKey);
    const iv = Buffer.from(ivB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    const tag = Buffer.from(tagB64, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    // If decryption fails we return empty string to avoid leaking ciphertext into UI.
    return "";
  }
}

export function encryptNullableStringForOrg(orgKey: string, value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return encryptStringForOrg(orgKey, trimmed);
}

export function decryptNullableStringForOrg(orgKey: string, value: string | null | undefined) {
  if (!value) return null;
  const decrypted = decryptStringForOrg(orgKey, value);
  return decrypted || null;
}

const jsonEncryptionPrefix = "encj:v1:";

export function encryptJsonForOrg(orgKey: string, value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.startsWith(jsonEncryptionPrefix)) {
    return value;
  }
  const json = JSON.stringify(value);
  return `${jsonEncryptionPrefix}${encryptStringForOrg(orgKey, json)}`;
}

export function decryptJsonForOrg(orgKey: string, value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const raw = value;
    if (raw.startsWith(jsonEncryptionPrefix)) {
      const decryptedJson = decryptStringForOrg(orgKey, raw.slice(jsonEncryptionPrefix.length));
      if (!decryptedJson) return null;
      try {
        return JSON.parse(decryptedJson) as unknown;
      } catch {
        return null;
      }
    }
    return value;
  }
  return value;
}
