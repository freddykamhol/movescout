import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { verifyAuthToken } from "@/lib/auth/tokens";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AcceptInvitePayload = {
  password?: string;
  token?: string;
  username?: string;
};

function sanitize(value: string | undefined) {
  return (value ?? "").trim();
}

function normalizeUsername(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().replace(/[^a-z0-9._-]+/g, "");
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: AcceptInvitePayload;
  try {
    payload = (await request.json()) as AcceptInvitePayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const token = sanitize(payload.token);
  const password = String(payload.password ?? "");
  const usernameRaw = sanitize(payload.username);

  if (!token || !password) {
    return NextResponse.json({ message: "Token und Passwort sind Pflicht." }, { status: 422 });
  }

  let verified;
  try {
    verified = await verifyAuthToken(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token ist ungültig.";
    return NextResponse.json({ message }, { status: 401 });
  }

  if (verified.type !== "invite") {
    return NextResponse.json({ message: "Token ist ungültig." }, { status: 401 });
  }

  if (verified.orgKey !== orgKey) {
    return NextResponse.json({ message: "Token gehört zu einer anderen Organisation." }, { status: 403 });
  }

  const user = await prisma.user.findFirst({ where: { id: verified.userId, orgKey } });
  if (!user) {
    return NextResponse.json({ message: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const username = usernameRaw ? normalizeUsername(usernameRaw) : normalizeUsername(user.username ?? "");
  const finalUsername =
    username ||
    normalizeUsername(user.email ?? "") ||
    normalizeUsername(user.displayName) ||
    `user-${user.id.slice(-6)}`;

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        username: finalUsername,
        passwordHash,
      },
    });

    return NextResponse.json({
      message: "Einladung angenommen. Passwort wurde gesetzt.",
      user: { id: updated.id, displayName: updated.displayName, username: updated.username, role: updated.role },
    });
  } catch (error) {
    console.error("Einladung annehmen fehlgeschlagen.", error);
    return NextResponse.json({ message: "Einladung konnte nicht angenommen werden." }, { status: 500 });
  }
}

