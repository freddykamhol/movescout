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
const sessionMaxAgeSeconds = 60 * 60 * 24;

function getBootstrapAdminCredentials() {
  return {
    username: (process.env.MOVESCOUT_BOOTSTRAP_ADMIN_USERNAME?.trim() || "Admin").trim(),
    password: process.env.MOVESCOUT_BOOTSTRAP_ADMIN_PASSWORD?.trim() || "Admin123",
  };
}

async function ensureDefaultAdmin(prisma: NonNullable<ReturnType<typeof getPrismaClient>>, orgKey: string) {
  const bootstrap = getBootstrapAdminCredentials();
  const existingAny = await prisma.user.findFirst({ where: { orgKey } });
  if (!existingAny) {
    await prisma.user.create({
      data: {
        displayName: "Administrator",
        username: bootstrap.username,
        passwordHash: await bcrypt.hash(bootstrap.password, 10),
        orgKey,
        role: "OWNER",
      },
    });
    return;
  }

  const adminUser = await prisma.user.findFirst({
    where: { orgKey, username: { equals: bootstrap.username, mode: "insensitive" } },
  });

  if (!adminUser) {
    const ownerWithoutPassword = await prisma.user.findFirst({
      where: { orgKey, role: "OWNER", passwordHash: null },
      orderBy: [{ createdAt: "asc" }],
    });

    if (ownerWithoutPassword) {
      await prisma.user.update({
        where: { id: ownerWithoutPassword.id },
        data: { username: bootstrap.username, passwordHash: await bcrypt.hash(bootstrap.password, 10) },
      });
      return;
    }

    await prisma.user.create({
      data: {
        displayName: "Administrator",
        username: bootstrap.username,
        passwordHash: await bcrypt.hash(bootstrap.password, 10),
        orgKey,
        role: "OWNER",
      },
    });
    return;
  }

  if (!adminUser.passwordHash) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { username: bootstrap.username, passwordHash: await bcrypt.hash(bootstrap.password, 10) },
    });
    return;
  }

  const matchesLegacy =
    (await bcrypt.compare("Admin", adminUser.passwordHash)) ||
    (await bcrypt.compare("Admin123", adminUser.passwordHash)) ||
    (bootstrap.password !== "Admin" && (await bcrypt.compare(bootstrap.password, adminUser.passwordHash)));

  if (!matchesLegacy) {
    return;
  }

  await prisma.user.update({
    where: { id: adminUser.id },
    data: { username: bootstrap.username, passwordHash: await bcrypt.hash(bootstrap.password, 10) },
  });
}

export async function POST(request: Request) {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
    }

    const orgKey = getOrgKeyFromRequest(request);
    await ensureOrganization(orgKey);
    await ensureDefaultAdmin(prisma, orgKey);

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
      where: { orgKey, username: { equals: username, mode: "insensitive" } },
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
      `${userCookieName}=${encodeURIComponent(user.id)}; Path=/; SameSite=Lax; Max-Age=${sessionMaxAgeSeconds}; HttpOnly${secure ? "; Secure" : ""}`,
    );

    return response;
  } catch {
    return NextResponse.json(
      { message: "Login derzeit nicht möglich. Bitte Datenbank/`DATABASE_URL` prüfen." },
      { status: 503 },
    );
  }
}
