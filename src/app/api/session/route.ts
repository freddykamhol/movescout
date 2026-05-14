import { NextResponse } from "next/server";

import { getSessionFromRequest } from "@/lib/auth";
import { ensureOrganization } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const prisma = getPrismaClient();

    if (!prisma) {
      return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
    }

    const session = await getSessionFromRequest(request);
    if (!session?.userId || !session.orgKey) {
      return NextResponse.json({ message: "Nicht eingeloggt." }, { status: 401 });
    }

    const orgKey = session.orgKey;
    const organization = await ensureOrganization(orgKey);

    if (!organization) {
      return NextResponse.json({ message: "Organisation konnte nicht initialisiert werden." }, { status: 500 });
    }

    const currentUser =
      (await prisma.user.findFirst({
        where: { orgKey, id: session.userId },
      })) ?? null;

    if (!currentUser) {
      return NextResponse.json({ message: "Session ist ungültig." }, { status: 401 });
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
  } catch {
    return NextResponse.json(
      { message: "Session konnte nicht geladen werden. Bitte Datenbank/`DATABASE_URL` prüfen." },
      { status: 503 },
    );
  }
}
