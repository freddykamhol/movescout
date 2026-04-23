import { NextResponse } from "next/server";

import { getCustomerTableRecordById } from "@/lib/customer-data";
import { encryptNullableStringForOrg, encryptStringForOrg } from "@/lib/crypto/data-encryption";
import { getCompanyLocationHash, getEmailHash, getPersonLocationHash } from "@/lib/crypto/pii-hash";
import { ensureCustomerDocumentStructure, renameCustomerDocumentStructure } from "@/lib/document-storage";
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const { customerId } = await params;

  let payload: CustomerPayload;

  try {
    payload = (await request.json()) as CustomerPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const existingCustomer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      orgKey,
    },
    select: {
      customerNumber: true,
      id: true,
    },
  });

  if (!existingCustomer) {
    return NextResponse.json({ message: "Kunde nicht gefunden." }, { status: 404 });
  }

  const nextCustomerNumber = sanitizeField(payload.customerNumber) || existingCustomer.customerNumber;

  try {
    // Produktiv: Dateistruktur liegt ausschließlich auf SFTP, also früh validieren.
    await ensureCustomerDocumentStructure(existingCustomer.customerNumber, orgKey);

    await prisma.customer.update({
      where: {
        id: customerId,
      },
      data: {
        customerNumber: nextCustomerNumber,
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

    if (existingCustomer.customerNumber !== nextCustomerNumber) {
      await renameCustomerDocumentStructure(existingCustomer.customerNumber, nextCustomerNumber, orgKey);
    } else {
      await ensureCustomerDocumentStructure(nextCustomerNumber, orgKey);
    }

    const customerRecord = await getCustomerTableRecordById(customerId);

    return NextResponse.json({
      customer: customerRecord,
      message: "Kunde wurde gespeichert.",
    });
  } catch (error) {
    const errorCode = getErrorCode(error);

    if (errorCode === "P2002") {
      return NextResponse.json({ message: "Die Kundennummer ist bereits vergeben." }, { status: 409 });
    }

    console.error("Kunde konnte nicht gespeichert werden.", error);
    const message = error instanceof Error ? error.message : "Der Kunde konnte nicht gespeichert werden.";
    const status = error instanceof Error && error.message.includes("SFTP ist nicht konfiguriert") ? 422 : 500;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const { customerId } = await params;

  try {
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        orgKey,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ message: "Kunde nicht gefunden." }, { status: 404 });
    }

    await prisma.customer.delete({ where: { id: customer.id } });

    return NextResponse.json({
      message: "Kunde wurde gelöscht.",
    });
  } catch (error) {
    console.error("Kunde konnte nicht gelöscht werden.", error);
    return NextResponse.json({ message: "Der Kunde konnte nicht gelöscht werden." }, { status: 500 });
  }
}
