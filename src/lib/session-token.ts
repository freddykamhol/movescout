import "server-only";

import { SignJWT, jwtVerify } from "jose";

export type MoveScoutSession = {
  orgKey: string;
  role: string;
  userId: string;
};

export function getSessionCookieName() {
  return "movescout_session";
}

function getSessionSecret() {
  const fromEnv = process.env.MOVESCOUT_SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;
  const legacy = process.env.MOVESCOUT_AUTH_TOKEN_SECRET?.trim();
  if (legacy) return legacy;
  return "movescout-dev-secret-change-me";
}

function getSessionKey() {
  return new TextEncoder().encode(getSessionSecret());
}

export function normalizeUsername(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().replace(/[^a-z0-9._-]+/g, "");
}

export async function createSessionToken(payload: MoveScoutSession) {
  const key = getSessionKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifySessionToken(token: string) {
  const key = getSessionKey();
  const verified = await jwtVerify(token, key, { algorithms: ["HS256"] });
  return verified.payload as unknown as MoveScoutSession;
}
