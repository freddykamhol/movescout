import { NextResponse } from "next/server";

import { sendUserPasswordResetMailForOrg } from "@/lib/auth/user-mails";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RequestResetPayload = {
  identifier?: string;
};

function sanitize(value: string | undefined) {
  return (value ?? "").trim();
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);
  const origin = new URL(request.url).origin;

  let payload: RequestResetPayload;
  try {
    payload = (await request.json()) as RequestResetPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const identifier = sanitize(payload.identifier);
  if (!identifier) {
    return NextResponse.json({ message: "Bitte E-Mail oder Benutzername angeben." }, { status: 422 });
  }

  const user = await prisma.user.findFirst({
    where: {
      orgKey,
      OR: [{ email: identifier }, { username: identifier.toLowerCase() }],
    },
  });

  // Always return 200 to avoid account enumeration.
  if (!user?.email) {
    return NextResponse.json({ message: "Wenn der Benutzer existiert, wurde eine Mail versendet." });
  }

  try {
    await sendUserPasswordResetMailForOrg(orgKey, { id: user.id, displayName: user.displayName, email: user.email }, origin);
  } catch (error) {
    console.error("Passwort-Reset Mail fehlgeschlagen.", error);
    // Still return generic response.
  }

  return NextResponse.json({ message: "Wenn der Benutzer existiert, wurde eine Mail versendet." });
}

