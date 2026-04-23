import { NextResponse } from "next/server";
import path from "node:path";

import { readStoredDocumentFileForOrg } from "@/lib/document-storage";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { sendOutgoingMailForOrg } from "@/lib/mailer";
import { createEncryptedZipBuffer } from "@/lib/zip/encrypted-zip";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SendDocumentsPayload = {
  message?: string;
  password?: string;
  subject?: string;
  to?: string;
  paths?: string[];
};

function sanitizeEmail(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed;
}

function sanitizeSubject(value: string | undefined) {
  return (value ?? "").trim();
}

function sanitizePassword(value: string | undefined) {
  return (value ?? "").trim();
}

function sanitizePathList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function makeSafeFileName(value: string) {
  const base = path.posix.basename(value.trim()) || "Dokument";
  return base.replace(/[^A-Za-z0-9._-]+/g, "-");
}

export async function POST(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: SendDocumentsPayload;
  try {
    payload = (await request.json()) as SendDocumentsPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const to = sanitizeEmail(payload.to);
  const subject = sanitizeSubject(payload.subject) || "MoveScout Dokumente";
  const password = sanitizePassword(payload.password);
  const message = (payload.message ?? "").trim();
  const paths = sanitizePathList(payload.paths);

  if (!to) {
    return NextResponse.json({ message: "Empfänger-E-Mail fehlt." }, { status: 422 });
  }

  if (!paths.length) {
    return NextResponse.json({ message: "Bitte mindestens ein Dokument auswählen." }, { status: 422 });
  }

  if (!password) {
    return NextResponse.json({ message: "Passwort zur Verschlüsselung fehlt." }, { status: 422 });
  }

  try {
    const attachments = await Promise.all(
      paths.map(async (relativePath) => {
        const file = await readStoredDocumentFileForOrg(orgKey, relativePath);
        if (!file) {
          throw new Error(`Dokument nicht gefunden: ${relativePath}`);
        }

        const zipBuffer = await createEncryptedZipBuffer(
          [{ fileName: file.fileName, buffer: file.buffer }],
          password,
        );

        const safeBase = makeSafeFileName(file.fileName.replace(/\.[^.]+$/, ""));
        return {
          filename: `${safeBase}.zip`,
          content: zipBuffer,
          contentType: "application/zip",
        };
      }),
    );

    const textLines = [
      message || "Anbei erhalten Sie die angeforderten Dokumente.",
      "",
      "Hinweis: Die Dokumente sind als verschlüsselte ZIP-Dateien angehängt.",
      "Passwort-Hinweis: wie vereinbart (z.B. PLZ der Rechnungsadresse).",
    ].filter(Boolean);

    await sendOutgoingMailForOrg(orgKey, {
      to,
      subject,
      text: textLines.join("\n"),
      attachments,
    });

    return NextResponse.json({ message: "Dokumente wurden per Mail versendet." });
  } catch (error) {
    console.error("Dokumentversand fehlgeschlagen.", error);
    const isDev = process.env.NODE_ENV !== "production";
    const raw = error instanceof Error ? error.message : "";
    const messageOut = isDev && raw ? `Dokumente konnten nicht versendet werden: ${raw}` : "Dokumente konnten nicht versendet werden.";
    return NextResponse.json({ message: messageOut }, { status: 500 });
  }
}
