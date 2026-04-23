import { NextResponse } from "next/server";

import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UpdateNodePayload = {
  email?: string;
  name?: string;
  parentId?: string | null;
  phone?: string;
  sortOrder?: number;
  title?: string;
};

function sanitizeOptional(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function sanitizeRequired(value: string | undefined) {
  return value?.trim() ?? "";
}

export async function PUT(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const { nodeId } = await params;

  let payload: UpdateNodePayload;
  try {
    payload = (await request.json()) as UpdateNodePayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const node = await prisma.orgChartNode.findFirst({ where: { id: nodeId, orgKey } });
  if (!node) {
    return NextResponse.json({ message: "Knoten nicht gefunden." }, { status: 404 });
  }

  const name = sanitizeRequired(payload.name) || node.name;

  const updated = await prisma.orgChartNode.update({
    where: { id: node.id },
    data: {
      name,
      title: sanitizeOptional(payload.title),
      email: sanitizeOptional(payload.email),
      phone: sanitizeOptional(payload.phone),
      parentId: payload.parentId?.trim() || null,
      sortOrder: Number.isFinite(payload.sortOrder) ? Math.max(0, payload.sortOrder ?? 0) : node.sortOrder,
    },
  });

  return NextResponse.json({ message: "Knoten wurde gespeichert.", node: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ nodeId: string }> }) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const { nodeId } = await params;
  const node = await prisma.orgChartNode.findFirst({ where: { id: nodeId, orgKey } });

  if (!node) {
    return NextResponse.json({ message: "Knoten nicht gefunden." }, { status: 404 });
  }

  await prisma.orgChartNode.delete({ where: { id: node.id } });
  return NextResponse.json({ message: "Knoten wurde gelöscht." });
}

