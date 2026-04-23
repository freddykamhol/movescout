import { NextResponse } from "next/server";

import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CreateNodePayload = {
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

export async function GET(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const nodes = await prisma.orgChartNode.findMany({
    where: { orgKey },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ nodes });
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: CreateNodePayload;
  try {
    payload = (await request.json()) as CreateNodePayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const name = sanitizeRequired(payload.name);
  if (!name) {
    return NextResponse.json({ message: "Bitte einen Namen angeben." }, { status: 422 });
  }

  const node = await prisma.orgChartNode.create({
    data: {
      orgKey,
      name,
      title: sanitizeOptional(payload.title),
      email: sanitizeOptional(payload.email),
      phone: sanitizeOptional(payload.phone),
      parentId: payload.parentId?.trim() || null,
      sortOrder: Number.isFinite(payload.sortOrder) ? Math.max(0, payload.sortOrder ?? 0) : 0,
    },
  });

  return NextResponse.json({ message: "Knoten wurde angelegt.", node });
}

