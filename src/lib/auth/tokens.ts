import "server-only";

import crypto from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

function getTokenSecret() {
  const raw = process.env.MOVESCOUT_AUTH_TOKEN_SECRET?.trim() || "";
  if (raw) {
    return new TextEncoder().encode(raw);
  }

  if (process.env.NODE_ENV !== "production") {
    // Dev fallback so invites/resets work without extra env.
    const fallback = crypto
      .createHash("sha256")
      .update(process.env.MOVESCOUT_DATA_ENCRYPTION_KEY?.trim() || "movescout-dev-auth-token")
      .digest("hex");
    return new TextEncoder().encode(fallback);
  }

  throw new Error("MOVESCOUT_AUTH_TOKEN_SECRET fehlt.");
}

export type InviteTokenPayload = {
  email: string | null;
  orgKey: string;
  type: "invite";
  userId: string;
};

export type PasswordResetTokenPayload = {
  orgKey: string;
  type: "password_reset";
  userId: string;
};

export type VerifiedTokenPayload = InviteTokenPayload | PasswordResetTokenPayload;

export async function signInviteToken(payload: Omit<InviteTokenPayload, "type">, expiresInHours = 72) {
  const secret = getTokenSecret();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload, type: "invite" as const })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInHours * 60 * 60)
    .sign(secret);
}

export async function signPasswordResetToken(payload: Omit<PasswordResetTokenPayload, "type">, expiresInHours = 2) {
  const secret = getTokenSecret();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload, type: "password_reset" as const })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInHours * 60 * 60)
    .sign(secret);
}

export async function verifyAuthToken(token: string): Promise<VerifiedTokenPayload> {
  const secret = getTokenSecret();
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  const type = payload.type;
  const orgKey = typeof payload.orgKey === "string" ? payload.orgKey : "";
  const userId = typeof payload.userId === "string" ? payload.userId : "";

  if (!orgKey || !userId) {
    throw new Error("Token ist ungültig.");
  }

  if (type === "invite") {
    return {
      type: "invite",
      orgKey,
      userId,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  }

  if (type === "password_reset") {
    return { type: "password_reset", orgKey, userId };
  }

  throw new Error("Token ist ungültig.");
}
