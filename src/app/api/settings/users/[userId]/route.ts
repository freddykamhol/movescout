import { NextResponse } from "next/server";

import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UpdateUserPayload = {
  displayName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
};

function sanitizeOptional(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function sanitizeRequired(value: string | undefined) {
  return value?.trim() ?? "";
}

export async function PUT(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const { userId } = await params;

  let payload: UpdateUserPayload;
  try {
    payload = (await request.json()) as UpdateUserPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ where: { id: userId, orgKey } });
  if (!user) {
    return NextResponse.json({ message: "Benutzer nicht gefunden." }, { status: 404 });
  }

  const displayName = sanitizeRequired(payload.displayName) || user.displayName;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      displayName,
      email: sanitizeOptional(payload.email),
      firstName: sanitizeOptional(payload.firstName),
      lastName: sanitizeOptional(payload.lastName),
      role: payload.role ?? user.role,
    },
  });

  return NextResponse.json({ message: "Benutzer wurde gespeichert.", user: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const { userId } = await params;
  const user = await prisma.user.findFirst({ where: { id: userId, orgKey } });

  if (!user) {
    return NextResponse.json({ message: "Benutzer nicht gefunden." }, { status: 404 });
  }

  await prisma.user.delete({ where: { id: user.id } });
  return NextResponse.json({ message: "Benutzer wurde gelöscht." });
}

