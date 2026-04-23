import { NextResponse } from "next/server";

import { getOrgKeyFromRequest, ensureOrganization } from "@/lib/org-context";
import { decryptJsonForOrg, decryptStringForOrg, encryptJsonForOrg, encryptStringForOrg } from "@/lib/crypto/data-encryption";
import { getPrismaClient } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { sendMoveCompletedMailForOrg, sendMovePlannedMailForOrg } from "@/lib/move-mails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PatchMovePayload = {
  destinationAddress?: string;
  originAddress?: string;
  plannedEndDate?: string | null;
  plannedStartDate?: string | null;
  pricingSummary?: unknown;
  status?: string;
  wizardData?: unknown;
};

function parseDate(value: string | null | undefined) {
  if (value === null) return null;
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isMoveStatus(value: unknown): value is "LEAD" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" {
  return value === "LEAD" || value === "PLANNED" || value === "IN_PROGRESS" || value === "COMPLETED" || value === "CANCELLED";
}

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
    include: {
      customer: {
        select: {
          id: true,
          customerNumber: true,
          company: true,
          address: true,
          postalCode: true,
          city: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!move) {
    return NextResponse.json({ message: "Umzug nicht gefunden." }, { status: 404 });
  }

  const customerCompany = move.customer.company ? decryptStringForOrg(orgKey, move.customer.company) : null;
  const customerFirstName = decryptStringForOrg(orgKey, move.customer.firstName);
  const customerLastName = decryptStringForOrg(orgKey, move.customer.lastName);
  const customerName =
    customerCompany || `${customerFirstName} ${customerLastName}`.trim() || move.customer.customerNumber;
  const customerAddress = decryptStringForOrg(orgKey, move.customer.address);
  const customerPostalCode = decryptStringForOrg(orgKey, move.customer.postalCode);
  const customerCity = decryptStringForOrg(orgKey, move.customer.city);
  const customerEmail = decryptStringForOrg(orgKey, move.customer.email);
  const customerPhone = decryptStringForOrg(orgKey, move.customer.phone);

  return NextResponse.json({
    move: {
      id: move.id,
      moveNumber: move.moveNumber,
      status: move.status,
      originAddress: move.originAddress ? decryptStringForOrg(orgKey, move.originAddress) : null,
      destinationAddress: move.destinationAddress ? decryptStringForOrg(orgKey, move.destinationAddress) : null,
      plannedStartDate: move.plannedDate?.toISOString() ?? null,
      plannedEndDate: move.plannedEndDate?.toISOString() ?? null,
      wizardData: decryptJsonForOrg(orgKey, move.wizardData),
      pricingSummary: move.pricingSummary,
      customer: {
        id: move.customer.id,
        customerNumber: move.customer.customerNumber,
        name: customerName,
        company: customerCompany,
        firstName: customerFirstName,
        lastName: customerLastName,
        address: customerAddress,
        postalCode: customerPostalCode,
        city: customerCity,
        email: customerEmail,
        phone: customerPhone,
      },
    },
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ moveId: string }> }) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);
  const { moveId } = await context.params;

  let payload: PatchMovePayload;
  try {
    payload = (await request.json()) as PatchMovePayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const plannedStartDate = parseDate(payload.plannedStartDate);
  const plannedEndDate = parseDate(payload.plannedEndDate);

  if (payload.plannedStartDate !== undefined && payload.plannedStartDate !== null && plannedStartDate === null) {
    return NextResponse.json({ message: "Start-Zeitpunkt ist ungültig." }, { status: 422 });
  }

  if (payload.plannedEndDate !== undefined && payload.plannedEndDate !== null && plannedEndDate === null) {
    return NextResponse.json({ message: "End-Zeitpunkt ist ungültig." }, { status: 422 });
  }

  if (plannedStartDate && plannedEndDate && plannedEndDate.getTime() < plannedStartDate.getTime()) {
    return NextResponse.json({ message: "Ende darf nicht vor Start liegen." }, { status: 422 });
  }

  if (payload.status !== undefined && !isMoveStatus(payload.status)) {
    return NextResponse.json({ message: "Ungültiger Status." }, { status: 422 });
  }

  const existing = await prisma.move.findFirst({
    where: { id: moveId, orgKey },
    select: {
      status: true,
      plannedDate: true,
      plannedEndDate: true,
      moveNumber: true,
      customer: {
        select: {
          customerNumber: true,
          company: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ message: "Umzug nicht gefunden." }, { status: 404 });
  }

  const wizardData =
    payload.wizardData === undefined ? undefined : (encryptJsonForOrg(orgKey, payload.wizardData) as unknown as Prisma.InputJsonValue);
  const pricingSummary = payload.pricingSummary === undefined ? undefined : (payload.pricingSummary as Prisma.InputJsonValue);

  const updated = await prisma.move.updateMany({
    where: { id: moveId, orgKey },
    data: {
      ...(payload.originAddress !== undefined
        ? { originAddress: payload.originAddress?.trim() ? encryptStringForOrg(orgKey, payload.originAddress.trim()) : null }
        : {}),
      ...(payload.destinationAddress !== undefined
        ? { destinationAddress: payload.destinationAddress?.trim() ? encryptStringForOrg(orgKey, payload.destinationAddress.trim()) : null }
        : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.plannedStartDate !== undefined ? { plannedDate: plannedStartDate } : {}),
      ...(payload.plannedEndDate !== undefined ? { plannedEndDate } : {}),
      ...(wizardData !== undefined ? { wizardData } : {}),
      ...(pricingSummary !== undefined ? { pricingSummary } : {}),
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ message: "Umzug nicht gefunden." }, { status: 404 });
  }

  // Trigger customer mails (best effort).
  try {
    const customerEmail = decryptStringForOrg(orgKey, existing.customer.email).trim();
    if (customerEmail) {
      const company = existing.customer.company ? decryptStringForOrg(orgKey, existing.customer.company) : "";
      const firstName = decryptStringForOrg(orgKey, existing.customer.firstName);
      const lastName = decryptStringForOrg(orgKey, existing.customer.lastName);
      const customerName = company || `${firstName} ${lastName}`.trim() || existing.customer.customerNumber;

      const nextStatus = payload.status ?? existing.status;
      const nextPlannedStart = payload.plannedStartDate !== undefined ? plannedStartDate : existing.plannedDate;
      const nextPlannedEnd = payload.plannedEndDate !== undefined ? plannedEndDate : existing.plannedEndDate;

      const plannedChanged =
        payload.plannedStartDate !== undefined &&
        ((existing.plannedDate?.getTime() ?? 0) !== (nextPlannedStart?.getTime() ?? 0));

      if ((nextStatus === "PLANNED" && existing.status !== "PLANNED") || plannedChanged) {
        await sendMovePlannedMailForOrg({
          orgKey,
          to: customerEmail,
          customerName,
          moveNumber: existing.moveNumber,
          plannedStart: nextPlannedStart ?? null,
          plannedEnd: nextPlannedEnd ?? null,
        });
      }

      if (nextStatus === "COMPLETED" && existing.status !== "COMPLETED") {
        await sendMoveCompletedMailForOrg({
          orgKey,
          to: customerEmail,
          customerName,
          moveNumber: existing.moveNumber,
        });
      }
    }
  } catch (error) {
    console.error("Move-Status Mail konnte nicht versendet werden.", error);
  }

  return NextResponse.json({ message: "Umzug aktualisiert." });
}
