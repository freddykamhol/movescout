import path from "node:path";

import { NextResponse } from "next/server";

import {
  ensureCustomerDocumentStructure,
  ensureMoveDocumentStructure,
  getCustomerDocumentsFolderRelativePath,
  getMoveDocumentsFolderRelativePath,
  writeStoredDocumentFileUniqueForOrg,
} from "@/lib/document-storage";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UploadScope = "customer" | "move";

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

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Upload erwartet multipart/form-data." }, { status: 400 });
  }

  const scope = String(formData.get("scope") ?? "").trim() as UploadScope;
  const customerNumber = String(formData.get("customerNumber") ?? "").trim();
  const moveNumber = String(formData.get("moveNumber") ?? "").trim();
  const file = formData.get("file");

  if (scope !== "customer" && scope !== "move") {
    return NextResponse.json({ message: "Ungültiger Upload-Scope." }, { status: 422 });
  }

  if (!customerNumber) {
    return NextResponse.json({ message: "Kundennummer fehlt." }, { status: 422 });
  }

  if (scope === "move" && !moveNumber) {
    return NextResponse.json({ message: "Umzugsnummer fehlt." }, { status: 422 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Datei fehlt." }, { status: 422 });
  }

  const incomingFileName = sanitizeFileName(file.name || "Dokument");
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (scope === "customer") {
      await ensureCustomerDocumentStructure(customerNumber, orgKey);
      const relativeFolder = getCustomerDocumentsFolderRelativePath(customerNumber);
      const unique = await writeStoredDocumentFileUniqueForOrg(orgKey, relativeFolder, incomingFileName, buffer);

      const relativePath = unique.relativePath;
      return NextResponse.json({
        fileName: unique.fileName,
        fileUrl: `/api/documents/file?path=${encodeURIComponent(relativePath)}`,
        relativePath,
      });
    }

    await ensureMoveDocumentStructure(customerNumber, moveNumber, orgKey);
    const relativeFolder = getMoveDocumentsFolderRelativePath(customerNumber, moveNumber);
    const unique = await writeStoredDocumentFileUniqueForOrg(orgKey, relativeFolder, incomingFileName, buffer);

    const relativePath = unique.relativePath;
    return NextResponse.json({
      fileName: unique.fileName,
      fileUrl: `/api/documents/file?path=${encodeURIComponent(relativePath)}`,
      relativePath,
    });
  } catch (error) {
    console.error("Upload fehlgeschlagen.", error);
    const message = error instanceof Error ? error.message : "Upload fehlgeschlagen.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
