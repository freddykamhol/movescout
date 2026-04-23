import { NextResponse } from "next/server";

import { deleteStoredDocumentFileForOrg } from "@/lib/document-storage";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DeletePayload = {
  path?: string;
};

export async function POST(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: DeletePayload;
  try {
    payload = (await request.json()) as DeletePayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const relativePath = payload.path?.trim();
  if (!relativePath) {
    return NextResponse.json({ message: "Dateipfad fehlt." }, { status: 422 });
  }

  try {
    const result = await deleteStoredDocumentFileForOrg(orgKey, relativePath);
    if (!result.ok) {
      return NextResponse.json({ message: "Datei nicht gefunden." }, { status: result.status });
    }
    return NextResponse.json({ message: "Datei wurde gelöscht." });
  } catch (error) {
    console.error("Delete fehlgeschlagen.", error);
    const message = error instanceof Error ? error.message : "Datei konnte nicht gelöscht werden.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
