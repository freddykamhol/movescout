import path from "node:path";

import { NextResponse } from "next/server";

import { deleteStoredDocumentFileForOrg, ensureOrganizationBrandingFolder, writeStoredDocumentFileForOrg } from "@/lib/document-storage";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxLogoBytes = 1024 * 1024; // 1 MB

function buildLogoUrl(relativePath: string) {
  return `/api/documents/file?path=${encodeURIComponent(relativePath)}`;
}

function getExtensionForMime(mimeType: string) {
  if (mimeType === "image/png") {
    return ".png";
  }
  if (mimeType === "image/jpeg") {
    return ".jpg";
  }
  return null;
}

async function safeDeleteRelative(orgKey: string, relativePath: string) {
  try {
    await deleteStoredDocumentFileForOrg(orgKey, relativePath);
  } catch {
    // ignore
  }
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  try {
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ message: "Logo-Upload erwartet multipart/form-data." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Logo-Datei fehlt." }, { status: 422 });
    }

    const extension = getExtensionForMime(file.type);
    if (!extension) {
      return NextResponse.json({ message: "Bitte PNG oder JPEG hochladen." }, { status: 422 });
    }

    if (file.size > maxLogoBytes) {
      return NextResponse.json({ message: "Logo ist zu groß (max. 1 MB)." }, { status: 422 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { relativeBrandingFolderPath } = await ensureOrganizationBrandingFolder(orgKey);

    // Keep a stable file name so PDFs can cache the URL safely.
    const fileName = `logo${extension}`;
    const relativePath = path.posix.join(relativeBrandingFolderPath, fileName);

    // Remove other common variants so we don't keep multiple stale logo files around.
    await Promise.all([
      safeDeleteRelative(orgKey, path.posix.join(relativeBrandingFolderPath, "logo.png")),
      safeDeleteRelative(orgKey, path.posix.join(relativeBrandingFolderPath, "logo.jpg")),
      safeDeleteRelative(orgKey, path.posix.join(relativeBrandingFolderPath, "logo.jpeg")),
    ]);

    await writeStoredDocumentFileForOrg(orgKey, relativePath, buffer);
    const organization = await prisma.organization.update({
      where: { orgKey },
      data: { logoPath: relativePath },
    });

    return NextResponse.json({
      message: "Logo wurde gespeichert.",
      organization,
      logoUrl: buildLogoUrl(relativePath),
    });
  } catch (error) {
    console.error("Logo-Upload fehlgeschlagen.", error);
    const message = error instanceof Error ? error.message : "Logo konnte nicht gespeichert werden.";
    const status = error instanceof Error && error.message.includes("SFTP ist nicht konfiguriert") ? 422 : 500;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  try {
    const existing = await prisma.organization.findUnique({ where: { orgKey } });
    if (!existing) {
      return NextResponse.json({ message: "Organisation nicht gefunden." }, { status: 404 });
    }

    if (existing.logoPath) {
      const fileName = path.basename(existing.logoPath);
      await safeDeleteRelative(orgKey, path.posix.join("_branding", fileName));
    }

    const organization = await prisma.organization.update({
      where: { orgKey },
      data: { logoPath: null },
    });

    return NextResponse.json({
      message: "Logo wurde entfernt.",
      organization,
      logoUrl: null,
    });
  } catch (error) {
    console.error("Logo konnte nicht entfernt werden.", error);
    const message = error instanceof Error ? error.message : "Logo konnte nicht entfernt werden.";
    const status = error instanceof Error && error.message.includes("SFTP ist nicht konfiguriert") ? 422 : 500;
    return NextResponse.json({ message }, { status });
  }
}
