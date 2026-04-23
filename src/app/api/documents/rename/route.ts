import path from "node:path";

import { NextResponse } from "next/server";

import { renameStoredDocumentFileForOrg } from "@/lib/document-storage";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RenamePayload = {
  nextFileName?: string;
  path?: string;
};

function sanitizeFileName(input: string) {
  const baseName = path.basename(input).trim();
  const normalized = baseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "Dokument";
}

export async function POST(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: RenamePayload;
  try {
    payload = (await request.json()) as RenamePayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const relativePath = payload.path?.trim();
  const nextFileNameRaw = payload.nextFileName?.trim();

  if (!relativePath) {
    return NextResponse.json({ message: "Dateipfad fehlt." }, { status: 422 });
  }

  if (!nextFileNameRaw) {
    return NextResponse.json({ message: "Neuer Dateiname fehlt." }, { status: 422 });
  }

  const nextFileName = sanitizeFileName(nextFileNameRaw);

  try {
    const result = await renameStoredDocumentFileForOrg(orgKey, relativePath, nextFileName);
    if (!result) {
      return NextResponse.json({ message: "Datei nicht gefunden." }, { status: 404 });
    }

    return NextResponse.json({
      fileName: result.fileName,
      fileUrl: `/api/documents/file?path=${encodeURIComponent(result.relativePath)}`,
      relativePath: result.relativePath,
      message: "Datei wurde umbenannt.",
    });
  } catch (error) {
    console.error("Rename fehlgeschlagen.", error);
    const message = error instanceof Error ? error.message : "Umbenennen fehlgeschlagen.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
