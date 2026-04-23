import { NextResponse } from "next/server";

import { sendUserInviteMailForOrg } from "@/lib/auth/user-mails";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateUserPayload = {
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

export async function GET(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const users = await prisma.user.findMany({
    where: { orgKey },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);
  const origin = new URL(request.url).origin;

  let payload: CreateUserPayload;
  try {
    payload = (await request.json()) as CreateUserPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const displayName = sanitizeRequired(payload.displayName);
  if (!displayName) {
    return NextResponse.json({ message: "Bitte einen Anzeigenamen angeben." }, { status: 422 });
  }

  const user = await prisma.user.create({
    data: {
      orgKey,
      displayName,
      email: sanitizeOptional(payload.email),
      firstName: sanitizeOptional(payload.firstName),
      lastName: sanitizeOptional(payload.lastName),
      role: payload.role ?? "MEMBER",
    },
  });

  if (user.email) {
    try {
      await sendUserInviteMailForOrg(orgKey, { id: user.id, displayName: user.displayName, email: user.email }, origin);
    } catch (error) {
      console.error("Einladung konnte nicht versendet werden.", error);
    }
  }

  return NextResponse.json({ message: "Benutzer wurde angelegt.", user });
}
