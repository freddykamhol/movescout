import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LoginPayload = {
  username?: string;
  password?: string;
};

const userCookieName = "movescout_user";

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const username = String(payload.username ?? "").trim();
  const password = String(payload.password ?? "");

  if (!username || !password) {
    return NextResponse.json({ message: "Benutzername und Passwort sind Pflicht." }, { status: 422 });
  }

  const user = await prisma.user.findFirst({
    where: { orgKey, username },
  });

  if (!user?.passwordHash) {
    return NextResponse.json({ message: "Login fehlgeschlagen." }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ message: "Login fehlgeschlagen." }, { status: 401 });
  }

  const response = NextResponse.json({
    message: "Login erfolgreich.",
    user: {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      role: user.role,
    },
  });

  const secure = process.env.NODE_ENV === "production";
  response.headers.append(
    "Set-Cookie",
    `${userCookieName}=${encodeURIComponent(user.id)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}; HttpOnly${secure ? "; Secure" : ""}`,
  );

  return response;
}

