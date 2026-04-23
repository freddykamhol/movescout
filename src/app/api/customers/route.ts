import { NextResponse } from "next/server";

import { getCustomerTableRecordById } from "@/lib/customer-data";
import { encryptNullableStringForOrg, encryptStringForOrg } from "@/lib/crypto/data-encryption";
import { getCompanyLocationHash, getEmailHash, getPersonLocationHash } from "@/lib/crypto/pii-hash";
import { ensureCustomerDocumentStructure } from "@/lib/document-storage";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CustomerPayload = {
  address?: string;
  city?: string;
  company?: string;
  customerNumber?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  postalCode?: string;
};

function sanitizeField(value: string | undefined) {
  return value?.trim() ?? "";
}

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

async function getNextCustomerNumber(orgKey: string) {
  const prisma = getPrismaClient();

  if (!prisma) {
    throw new Error("Prisma ist nicht verfügbar.");
  }

  const customers = await prisma.customer.findMany({
    select: {
      customerNumber: true,
    },
    where: {
      orgKey,
    },
  });
  const highestNumber = customers.reduce((maxValue, customer) => {
    const numericPart = Number.parseInt(customer.customerNumber.replace(/\D/g, ""), 10);
    return Number.isNaN(numericPart) ? maxValue : Math.max(maxValue, numericPart);
  }, 1000);

  return `KD-${String(highestNumber + 1).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: CustomerPayload;

  try {
    payload = (await request.json()) as CustomerPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const customerNumber = sanitizeField(payload.customerNumber) || (await getNextCustomerNumber(orgKey));

  if (!sanitizeField(payload.firstName) && !sanitizeField(payload.lastName) && !sanitizeField(payload.company)) {
    return NextResponse.json({ message: "Bitte mindestens Firma oder einen Ansprechpartner erfassen." }, { status: 422 });
  }

  try {
    // SFTP ist für den produktiven Dateiablage-Workflow verpflichtend.
    // Wir legen den Kundenordner vor dem DB-Insert an, damit wir im Fehlerfall keinen "halben" Kunden speichern.
    await ensureCustomerDocumentStructure(customerNumber, orgKey);

    const customer = await prisma.customer.create({
      data: {
        orgKey,
        customerNumber,
        company: encryptNullableStringForOrg(orgKey, sanitizeField(payload.company)),
        firstName: encryptStringForOrg(orgKey, sanitizeField(payload.firstName)),
        lastName: encryptStringForOrg(orgKey, sanitizeField(payload.lastName)),
        address: encryptStringForOrg(orgKey, sanitizeField(payload.address)),
        postalCode: encryptStringForOrg(orgKey, sanitizeField(payload.postalCode)),
        city: encryptStringForOrg(orgKey, sanitizeField(payload.city)),
        phone: encryptStringForOrg(orgKey, sanitizeField(payload.phone)),
        email: encryptStringForOrg(orgKey, sanitizeField(payload.email).toLowerCase()),
        emailHash: getEmailHash(payload.email),
        companyLocationHash: getCompanyLocationHash(payload.company, payload.postalCode, payload.city),
        personLocationHash: getPersonLocationHash(payload.firstName, payload.lastName, payload.postalCode, payload.city, payload.address),
      },
    });

    const customerRecord = await getCustomerTableRecordById(customer.id);

    return NextResponse.json({
      customer: customerRecord,
      message: "Kunde wurde angelegt.",
    });
  } catch (error) {
    const errorCode = getErrorCode(error);

    if (errorCode === "P2002") {
      return NextResponse.json({ message: "Die Kundennummer ist bereits vergeben." }, { status: 409 });
    }

    console.error("Kunde konnte nicht angelegt werden.", error);
    const message = error instanceof Error ? error.message : "Der Kunde konnte nicht gespeichert werden.";
    const status = error instanceof Error && error.message.includes("SFTP ist nicht konfiguriert") ? 422 : 500;
    return NextResponse.json({ message }, { status });
  }
}
