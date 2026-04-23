import { NextResponse } from "next/server";

import { listMoveDocumentFiles } from "@/lib/document-storage";
import { getOrgKeyFromRequest, ensureOrganization } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ moveId: string }> }) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);
  const { moveId } = await context.params;

  const move = await prisma.move.findFirst({
    where: { id: moveId, orgKey },
    include: { customer: { select: { customerNumber: true } } },
  });

  if (!move) {
    return NextResponse.json({ message: "Umzug nicht gefunden." }, { status: 404 });
  }

  try {
    const files = await listMoveDocumentFiles(move.customer.customerNumber, move.moveNumber, orgKey);
    return NextResponse.json({ files });
  } catch (error) {
    console.error("Umzugsdokumente konnten nicht geladen werden.", error);
    const message = error instanceof Error ? error.message : "Umzugsdokumente konnten nicht geladen werden.";
    const status = error instanceof Error && error.message.includes("SFTP ist nicht konfiguriert") ? 422 : 500;
    return NextResponse.json({ message, files: [] }, { status });
  }
}
