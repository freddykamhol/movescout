import "server-only";

import crypto from "node:crypto";

function getHashKey() {
  const raw = process.env.MOVESCOUT_DATA_ENCRYPTION_KEY?.trim() || "";
  if (!raw) {
    if (process.env.NODE_ENV !== "production") {
      return crypto.createHash("sha256").update("movescout-dev-encryption-key").digest();
    }
    throw new Error("MOVESCOUT_DATA_ENCRYPTION_KEY fehlt.");
  }

  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : crypto.createHash("sha256").update(key).digest();
}

function normalize(input: string | null | undefined) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function hmacHash(value: string) {
  const key = getHashKey();
  return crypto.createHmac("sha256", key).update(value, "utf8").digest("base64");
}

export function getEmailHash(email: string | null | undefined) {
  const normalized = normalize(email);
  if (!normalized) return null;
  return hmacHash(`email:${normalized}`);
}

export function getCompanyLocationHash(company: string | null | undefined, postalCode: string | null | undefined, city: string | null | undefined) {
  const companyNorm = normalize(company);
  const postalNorm = normalize(postalCode);
  const cityNorm = normalize(city);
  if (!companyNorm || !postalNorm || !cityNorm) return null;
  return hmacHash(`company:${companyNorm}|plz:${postalNorm}|city:${cityNorm}`);
}

export function getPersonLocationHash(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  postalCode: string | null | undefined,
  city: string | null | undefined,
  address: string | null | undefined,
) {
  const firstNorm = normalize(firstName);
  const lastNorm = normalize(lastName);
  const postalNorm = normalize(postalCode);
  const cityNorm = normalize(city);
  const addressNorm = normalize(address);
  if (!firstNorm || !lastNorm || !postalNorm || !cityNorm) return null;
  const addressPart = addressNorm ? `|addr:${addressNorm}` : "";
  return hmacHash(`person:${firstNorm} ${lastNorm}|plz:${postalNorm}|city:${cityNorm}${addressPart}`);
}

