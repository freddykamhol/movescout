import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const userCookieName = "movescout_user";

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

  if (!organization) {
    return NextResponse.json({ message: "Organisation konnte nicht initialisiert werden." }, { status: 500 });
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const preferredUserId = cookies.get(userCookieName)?.trim() || null;

  let currentUser =
    preferredUserId
      ? await prisma.user.findFirst({
          where: {
            id: preferredUserId,
            orgKey,
          },
        })
      : null;

  if (!currentUser) {
    currentUser = await prisma.user.findFirst({
      where: {
        orgKey,
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
  }

  if (!currentUser) {
    currentUser = await prisma.user.create({
      data: {
        displayName: "Administrator",
        username: "admin",
        passwordHash: await bcrypt.hash("Admin", 10),
        orgKey,
        role: "OWNER",
      },
    });
  }

  const response = NextResponse.json({
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

  response.headers.append(
    "Set-Cookie",
    `${userCookieName}=${encodeURIComponent(currentUser.id)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}; HttpOnly${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  );

  return response;
}
