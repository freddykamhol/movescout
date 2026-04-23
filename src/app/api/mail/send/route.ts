import { NextResponse } from "next/server";

import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { sendOutgoingMailForOrg } from "@/lib/mailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SendMailPayload = {
  html?: string;
  subject?: string;
  text?: string;
  to?: string;
};

export async function POST(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: SendMailPayload;
  try {
    payload = (await request.json()) as SendMailPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const to = String(payload.to ?? "").trim();
  const subject = String(payload.subject ?? "").trim();
  const text = payload.text ? String(payload.text) : undefined;
  const html = payload.html ? String(payload.html) : undefined;

  if (!to || !subject || (!text && !html)) {
    return NextResponse.json({ message: "to, subject und text/html sind Pflicht." }, { status: 422 });
  }

  try {
    await sendOutgoingMailForOrg(orgKey, { to, subject, text, html });
    return NextResponse.json({ message: "Mail wurde versendet." });
  } catch (error) {
    const isDev = process.env.NODE_ENV !== "production";
    const message =
      isDev && error instanceof Error ? `Mail konnte nicht versendet werden: ${error.message}` : "Mail konnte nicht versendet werden.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
