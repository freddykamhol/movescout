import { basename, extname } from "node:path";

import { NextResponse } from "next/server";

import { readStoredDocumentFileForOrg } from "@/lib/document-storage";
import { getOrgKeyFromRequest } from "@/lib/org-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getContentType(fileName: string) {
  const extension = extname(fileName).toLowerCase();

  if (extension === ".pdf") {
    return "application/pdf";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".gif") {
    return "image/gif";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".svg") {
    return "image/svg+xml";
  }

  if (extension === ".txt") {
    return "text/plain; charset=utf-8";
  }

  if (extension === ".csv") {
    return "text/csv; charset=utf-8";
  }

  if (extension === ".doc") {
    return "application/msword";
  }

  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (extension === ".xls") {
    return "application/vnd.ms-excel";
  }

  if (extension === ".xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  return "application/octet-stream";
}

export async function GET(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  const { searchParams } = new URL(request.url);
  const relativePath = searchParams.get("path")?.trim();

  if (!relativePath) {
    return NextResponse.json({ message: "Dateipfad fehlt." }, { status: 400 });
  }

  try {
    const file = await readStoredDocumentFileForOrg(orgKey, relativePath);
    if (!file) {
      return NextResponse.json({ message: "Dokument nicht gefunden." }, { status: 404 });
    }

    const fileName = basename(file.fileName);
    const arrayBuffer = file.buffer.buffer.slice(
      file.buffer.byteOffset,
      file.buffer.byteOffset + file.buffer.byteLength,
    ) as ArrayBuffer;
    const body = new Blob([arrayBuffer], { type: getContentType(fileName) });
    return new NextResponse(body, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": String(file.size),
        "Content-Type": getContentType(fileName),
      },
    });
  } catch (error) {
    console.error("Dokument-Download fehlgeschlagen.", error);
    const message = error instanceof Error ? error.message : "Dokument konnte nicht geladen werden.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
