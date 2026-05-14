import { NextResponse } from "next/server";

import bcrypt from "bcryptjs";

import { createSessionToken, normalizeUsername, setSessionCookie } from "@/lib/auth";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBootstrapCredentials() {
  const username = normalizeUsername(process.env.MOVESCOUT_BOOTSTRAP_ADMIN_USERNAME?.trim() || "admin") || "admin";
  const password = (process.env.MOVESCOUT_BOOTSTRAP_ADMIN_PASSWORD?.trim() || "movescout").trim() || "movescout";
  return { username, password };
}

async function ensureBootstrapUser(orgKey: string) {
  const prisma = getPrismaClient();
  if (!prisma) return;

  const bootstrap = getBootstrapCredentials();
  const existing = await prisma.user.findFirst({
    where: { orgKey, username: { equals: bootstrap.username, mode: "insensitive" } },
  });
  if (existing?.passwordHash) return;

  const passwordHash = await bcrypt.hash(bootstrap.password, 10);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: bootstrap.username,
        passwordHash,
        displayName: existing.displayName || "Administrator",
        role: existing.role || "OWNER",
      },
    });
    return;
  }

  await prisma.user.create({
    data: {
      orgKey,
      username: bootstrap.username,
      passwordHash,
      displayName: "Administrator",
      role: "OWNER",
    },
  });
}

export async function POST(request: Request) {
  try {
    const prisma = getPrismaClient();
    if (!prisma) {
      return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
    }

    const orgKey = getOrgKeyFromRequest(request);
    const organization = await ensureOrganization(orgKey);
    if (!organization) {
      return NextResponse.json({ message: "Organisation konnte nicht initialisiert werden." }, { status: 500 });
    }

    await ensureBootstrapUser(orgKey);

    const body = (await request.json().catch(() => null)) as null | { username?: string; password?: string };
    const username = normalizeUsername(body?.username || "");
    const password = String(body?.password || "");

    if (!username || !password) {
      return NextResponse.json({ message: "Bitte Benutzername und Passwort eingeben." }, { status: 400 });
    }

    const user =
      (await prisma.user.findFirst({
        where: { orgKey, username: { equals: username, mode: "insensitive" } },
      })) ?? null;

    if (!user?.passwordHash) {
      return NextResponse.json({ message: "Login fehlgeschlagen." }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ message: "Login fehlgeschlagen." }, { status: 401 });
    }

    const token = await createSessionToken({ orgKey, userId: user.id, role: user.role });
    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      organization: { orgKey: organization.orgKey, name: organization.name },
      user: { id: user.id, displayName: user.displayName, email: user.email, role: user.role },
    });
  } catch (error) {
    const isProd = process.env.NODE_ENV === "production";
    const extra =
      !isProd && error && typeof error === "object" && "code" in error
        ? ` (code: ${String((error as { code?: unknown }).code)})`
        : "";

    return NextResponse.json(
      {
        message: `Login nicht möglich. Bitte Datenbankzugang prüfen.${extra}`,
      },
      { status: 500 },
    );
  }
}
