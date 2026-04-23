import { NextResponse } from "next/server";

import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CompanyPayload = {
  bankName?: string;
  bic?: string;
  city?: string;
  country?: string;
  email?: string;
  isSmallBusiness?: boolean;
  iban?: string;
  legalName?: string;
  name?: string;
  phone?: string;
  postalCode?: string;
  street?: string;
  vatId?: string;
  taxNumber?: string;
  vatRatePercent?: number;
  website?: string;
};

function sanitizeOptional(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function sanitizeRequired(value: string | undefined, fallbackValue: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : fallbackValue;
}

function sanitizeBoolean(value: boolean | undefined, fallbackValue: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallbackValue;
}

function sanitizeVatRatePercent(value: number | undefined, fallbackValue: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallbackValue;
  }

  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 100) {
    return fallbackValue;
  }

  return rounded;
}

export async function GET(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const organization = await prisma.organization.findUnique({
    where: { orgKey },
  });

  if (!organization) {
    return NextResponse.json({ message: "Organisation nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ organization });
}

export async function PUT(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: CompanyPayload;

  try {
    payload = (await request.json()) as CompanyPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const existing = await prisma.organization.findUnique({ where: { orgKey } });

  if (!existing) {
    return NextResponse.json({ message: "Organisation nicht gefunden." }, { status: 404 });
  }

  const organization = await prisma.organization.update({
    where: { orgKey },
    data: {
      name: sanitizeRequired(payload.name, existing.name),
      legalName: sanitizeOptional(payload.legalName),
      vatId: sanitizeOptional(payload.vatId),
      taxNumber: sanitizeOptional(payload.taxNumber),
      isSmallBusiness: sanitizeBoolean(payload.isSmallBusiness, existing.isSmallBusiness),
      vatRatePercent: sanitizeVatRatePercent(payload.vatRatePercent, existing.vatRatePercent),
      street: sanitizeOptional(payload.street),
      postalCode: sanitizeOptional(payload.postalCode),
      city: sanitizeOptional(payload.city),
      country: sanitizeOptional(payload.country),
      phone: sanitizeOptional(payload.phone),
      email: sanitizeOptional(payload.email),
      website: sanitizeOptional(payload.website),
      bankName: sanitizeOptional(payload.bankName),
      iban: sanitizeOptional(payload.iban),
      bic: sanitizeOptional(payload.bic),
    },
  });

  return NextResponse.json({
    message: "Firmendaten wurden gespeichert.",
    organization,
    savedAt: new Date().toISOString(),
  });
}
