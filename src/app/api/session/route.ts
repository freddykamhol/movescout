import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const userCookieName = "movescout_user";

async function ensureDefaultAdmin(prisma: NonNullable<ReturnType<typeof getPrismaClient>>, orgKey: string) {
  const existingAny = await prisma.user.findFirst({ where: { orgKey } });
  if (!existingAny) {
    await prisma.user.create({
      data: {
        displayName: "Administrator",
        username: "Admin",
        passwordHash: await bcrypt.hash("Admin123", 10),
        orgKey,
        role: "OWNER",
      },
    });
    return;
  }

  const adminUser = await prisma.user.findFirst({
    where: { orgKey, username: { equals: "Admin", mode: "insensitive" } },
  });

  if (!adminUser?.passwordHash) {
    return;
  }

  const matchesLegacy = await bcrypt.compare("Admin", adminUser.passwordHash);
  if (!matchesLegacy) {
    return;
  }

  await prisma.user.update({
    where: { id: adminUser.id },
    data: { username: "Admin", passwordHash: await bcrypt.hash("Admin123", 10) },
  });
}

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }

  const map = new Map<string, string>();
  cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const equalIndex = part.indexOf("=");
      if (equalIndex <= 0) {
        return;
      }
      const key = part.slice(0, equalIndex).trim();
      const value = part.slice(equalIndex + 1).trim();
      map.set(key, decodeURIComponent(value));
    });

  return map;
}

export async function GET(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  const organization = await ensureOrganization(orgKey);
  await ensureDefaultAdmin(prisma, orgKey);

  if (!organization) {
    return NextResponse.json({ message: "Organisation konnte nicht initialisiert werden." }, { status: 500 });
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const preferredUserId = cookies.get(userCookieName)?.trim() || null;

  if (!preferredUserId) {
    return NextResponse.json({ message: "Nicht eingeloggt." }, { status: 401 });
  }

  const currentUser = await prisma.user.findFirst({
    where: {
      id: preferredUserId,
      orgKey,
    },
  });

  if (!currentUser) {
    return NextResponse.json({ message: "Nicht eingeloggt." }, { status: 401 });
  }

  return NextResponse.json({
    organization: {
      orgKey: organization.orgKey,
      name: organization.name,
    },
    user: {
      id: currentUser.id,
      displayName: currentUser.displayName,
      email: currentUser.email,
      role: currentUser.role,
    },
  });
}
