import { NextResponse } from "next/server";

import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { sendOutgoingMailForOrg } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TestMailPayload = {
  to?: string;
};

export async function POST(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: TestMailPayload;
  try {
    payload = (await request.json()) as TestMailPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const to = String(payload.to ?? "").trim();
  if (!to) {
    return NextResponse.json({ message: "Empfänger fehlt." }, { status: 422 });
  }

  try {
    await sendOutgoingMailForOrg(orgKey, {
      to,
      subject: "MoveScout Testmail",
      text: "Wenn du diese E-Mail liest, ist der Mailserver korrekt konfiguriert.",
    });
    return NextResponse.json({ message: "Testmail wurde versendet." });
  } catch (error) {
    const isDev = process.env.NODE_ENV !== "production";
    const message =
      isDev && error instanceof Error ? `Testmail fehlgeschlagen: ${error.message}` : "Testmail fehlgeschlagen.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

