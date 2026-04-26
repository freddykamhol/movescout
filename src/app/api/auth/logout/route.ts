import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const userCookieName = "movescout_user";

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production";
  return `${userCookieName}=; Path=/; SameSite=Lax; Max-Age=0; HttpOnly${secure ? "; Secure" : ""}`;
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}

export async function GET() {
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookie());
  return response;
}

