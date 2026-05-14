import "server-only";

import { cookies, headers } from "next/headers";

import {
  createSessionToken,
  getSessionCookieName,
  normalizeUsername,
  type MoveScoutSession,
  verifySessionToken,
} from "@/lib/session-token";

export { createSessionToken, normalizeUsername, verifySessionToken };
export type { MoveScoutSession };

export const sessionCookieName = getSessionCookieName();

export async function getSessionFromRequest(request: Request): Promise<MoveScoutSession | null> {
  const cookieHeader = request.headers.get("cookie") || "";
  const needle = `${sessionCookieName}=`;
  const raw = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(needle));
  if (!raw) return null;

  const token = decodeURIComponent(raw.slice(needle.length));
  if (!token) return null;

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function getSessionFromNextCookies(): Promise<MoveScoutSession | null> {
  const token = (await cookies()).get(sessionCookieName)?.value?.trim();
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const isProd = process.env.NODE_ENV === "production";
  (await cookies()).set(sessionCookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  (await cookies()).set(sessionCookieName, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
}

export async function getRequestPathname() {
  const header = (await headers()).get("x-invoke-path")?.trim();
  if (header) return header;
  return "";
}

