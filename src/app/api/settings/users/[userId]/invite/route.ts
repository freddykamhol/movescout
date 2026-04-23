import { NextResponse } from "next/server";

import { sendUserInviteMailForOrg } from "@/lib/auth/user-mails";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);
  const origin = new URL(request.url).origin;
  const { userId } = await context.params;

  const user = await prisma.user.findFirst({ where: { id: userId, orgKey } });
  if (!user) {
    return NextResponse.json({ message: "Benutzer nicht gefunden." }, { status: 404 });
  }

  if (!user.email) {
    return NextResponse.json({ message: "Benutzer hat keine E-Mail." }, { status: 422 });
  }

  try {
    await sendUserInviteMailForOrg(orgKey, { id: user.id, displayName: user.displayName, email: user.email }, origin);
    return NextResponse.json({ message: "Einladung wurde versendet." });
  } catch (error) {
    console.error("Einladung konnte nicht versendet werden.", error);
    const isDev = process.env.NODE_ENV !== "production";
    const message =
      isDev && error instanceof Error ? `Einladung konnte nicht versendet werden: ${error.message}` : "Einladung konnte nicht versendet werden.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

