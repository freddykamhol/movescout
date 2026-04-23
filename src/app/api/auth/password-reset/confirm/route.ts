import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { verifyAuthToken } from "@/lib/auth/tokens";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ConfirmResetPayload = {
  password?: string;
  token?: string;
};

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: ConfirmResetPayload;
  try {
    payload = (await request.json()) as ConfirmResetPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const token = String(payload.token ?? "").trim();
  const password = String(payload.password ?? "");

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

  if (verified.type !== "password_reset") {
    return NextResponse.json({ message: "Token ist ungültig." }, { status: 401 });
  }

  if (verified.orgKey !== orgKey) {
    return NextResponse.json({ message: "Token gehört zu einer anderen Organisation." }, { status: 403 });
  }

  const user = await prisma.user.findFirst({ where: { id: verified.userId, orgKey } });
  if (!user) {
    return NextResponse.json({ message: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return NextResponse.json({ message: "Passwort wurde aktualisiert." });
}

