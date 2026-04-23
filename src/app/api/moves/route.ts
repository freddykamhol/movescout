import { NextResponse } from "next/server";

import { encryptNullableStringForOrg, encryptStringForOrg, encryptJsonForOrg } from "@/lib/crypto/data-encryption";
import { decryptStringForOrg, decryptNullableStringForOrg } from "@/lib/crypto/data-encryption";
import { getCompanyLocationHash, getEmailHash, getPersonLocationHash } from "@/lib/crypto/pii-hash";
import { ensureCustomerDocumentStructure, ensureMoveDocumentStructure } from "@/lib/document-storage";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { sendMoveCreatedMailForOrg } from "@/lib/move-mails";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MoveCustomerPayload = {
  address?: string;
  city?: string;
  company?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  postalCode?: string;
};

type MoveAddressPayload = {
  city?: string;
  houseNumber?: string;
  postalCode?: string;
  street?: string;
};

type CreateMovePayload = {
  customer?: MoveCustomerPayload;
  customerId?: string;
  moveInAddress?: MoveAddressPayload;
  moveOutAddress?: MoveAddressPayload;
  plannedDate?: string;
  pricingSummary?: unknown;
  wizardData?: unknown;
};

function sanitizeField(value: string | undefined) {
  return value?.trim() ?? "";
}

function formatAddress(address: MoveAddressPayload | undefined) {
  const streetLine = [sanitizeField(address?.street), sanitizeField(address?.houseNumber)].filter(Boolean).join(" ");
  const cityLine = [sanitizeField(address?.postalCode), sanitizeField(address?.city)].filter(Boolean).join(" ");

  return [streetLine, cityLine].filter(Boolean).join(", ");
}

function isUnknownPrismaArgument(error: unknown, argumentName: string) {
  return error instanceof Error && error.message.includes(`Unknown argument \`${argumentName}\``);
}

function parsePlannedDate(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPlannedDate(date: Date | null) {
  if (!date) {
    return "Noch kein Termin";
  }

  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

async function getNextMoveNumber(orgKey: string) {
  const prisma = getPrismaClient();

  if (!prisma) {
    throw new Error("Prisma ist nicht verfügbar.");
  }

  const moves = await prisma.move.findMany({
    select: {
      moveNumber: true,
    },
    where: {
      orgKey,
    },
  });
  const highestNumber = moves.reduce((maxValue, move) => {
    const numericPart = Number.parseInt(move.moveNumber.replace(/\D/g, ""), 10);
    return Number.isNaN(numericPart) ? maxValue : Math.max(maxValue, numericPart);
  }, 3000);

  return `UM-${String(highestNumber + 1).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: CreateMovePayload;

  try {
    payload = (await request.json()) as CreateMovePayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  try {
    const originAddress = formatAddress(payload.moveOutAddress);
    const destinationAddress = formatAddress(payload.moveInAddress);

    if (!originAddress || !destinationAddress) {
      return NextResponse.json({ message: "Bitte Auszugs- und Einzugsadresse vollständig erfassen." }, { status: 422 });
    }

    let customer = payload.customerId
      ? await prisma.customer.findFirst({
          where: {
            id: payload.customerId,
            orgKey,
          },
        })
      : null;

    if (!customer) {
      const customerPayload = payload.customer;

      if (!customerPayload) {
        return NextResponse.json({ message: "Für den Umzug wird ein Kunde benötigt." }, { status: 422 });
      }

      if (!sanitizeField(customerPayload.firstName) && !sanitizeField(customerPayload.lastName) && !sanitizeField(customerPayload.company)) {
        return NextResponse.json({ message: "Bitte mindestens Firma oder Ansprechpartner für den Kunden erfassen." }, { status: 422 });
      }

      const customerNumber = await getNextCustomerNumber(orgKey);

      // Produktiv: Dateistruktur liegt ausschließlich auf SFTP, daher vor dem DB-Insert anlegen/prüfen.
      await ensureCustomerDocumentStructure(customerNumber, orgKey);

      customer = await prisma.customer.create({
        data: {
          orgKey,
          customerNumber,
          company: encryptNullableStringForOrg(orgKey, sanitizeField(customerPayload.company)),
          firstName: encryptStringForOrg(orgKey, sanitizeField(customerPayload.firstName)),
          lastName: encryptStringForOrg(orgKey, sanitizeField(customerPayload.lastName)),
          address: encryptStringForOrg(orgKey, sanitizeField(customerPayload.address)),
          postalCode: encryptStringForOrg(orgKey, sanitizeField(customerPayload.postalCode)),
          city: encryptStringForOrg(orgKey, sanitizeField(customerPayload.city)),
          phone: encryptStringForOrg(orgKey, sanitizeField(customerPayload.phone)),
          email: encryptStringForOrg(orgKey, sanitizeField(customerPayload.email).toLowerCase()),
          emailHash: getEmailHash(customerPayload.email),
          companyLocationHash: getCompanyLocationHash(customerPayload.company, customerPayload.postalCode, customerPayload.city),
          personLocationHash: getPersonLocationHash(
            customerPayload.firstName,
            customerPayload.lastName,
            customerPayload.postalCode,
            customerPayload.city,
            customerPayload.address,
          ),
        },
      });
    }

    const moveNumber = await getNextMoveNumber(orgKey);
    await ensureMoveDocumentStructure(customer.customerNumber, moveNumber, orgKey);

    const wizardData =
      payload.wizardData === undefined
        ? undefined
        : (encryptJsonForOrg(orgKey, payload.wizardData) as unknown as Prisma.InputJsonValue);
    const pricingSummary = payload.pricingSummary === undefined ? undefined : (payload.pricingSummary as Prisma.InputJsonValue);
    const plannedDate = parsePlannedDate(payload.plannedDate);
    const baseMoveData = {
      orgKey,
      moveNumber,
      customerId: customer.id,
      originAddress: encryptStringForOrg(orgKey, originAddress),
      destinationAddress: encryptStringForOrg(orgKey, destinationAddress),
      status: "LEAD" as const,
      ...(plannedDate ? { plannedDate } : {}),
    };

    let move: { id: string; moveNumber: string; status: string };

    try {
      move = await prisma.move.create({
        data: {
          ...baseMoveData,
          ...(wizardData !== undefined ? { wizardData } : {}),
          ...(pricingSummary !== undefined ? { pricingSummary } : {}),
        } as unknown as Prisma.MoveCreateInput,
      });
    } catch (error) {
      // Dev-Server / PrismaClient kann nach Schema-Änderungen über HMR "alt" sein (ohne neue JSON-Felder).
      // Dann speichern wir den Umzug trotzdem, nur ohne `wizardData`/`pricingSummary`.
      if (isUnknownPrismaArgument(error, "wizardData") || isUnknownPrismaArgument(error, "pricingSummary")) {
        move = await prisma.move.create({
          data: baseMoveData as unknown as Prisma.MoveCreateInput,
        });
      } else {
        throw error;
      }
    }

    // E-Mail: Umzug angelegt
    try {
      const customerEmail = decryptStringForOrg(orgKey, customer.email).trim();
      if (customerEmail) {
        const company = decryptNullableStringForOrg(orgKey, customer.company) ?? "";
        const firstName = decryptStringForOrg(orgKey, customer.firstName);
        const lastName = decryptStringForOrg(orgKey, customer.lastName);
        const customerName = company || `${firstName} ${lastName}`.trim() || customer.customerNumber;

        await sendMoveCreatedMailForOrg({
          orgKey,
          to: customerEmail,
          customerName,
          moveNumber: move.moveNumber,
          originAddress,
          destinationAddress,
        });
      }
    } catch (error) {
      console.error("Move-Created Mail konnte nicht versendet werden.", error);
    }

    return NextResponse.json({
      message: "Umzug wurde angelegt.",
      move: {
        id: move.id,
        moveNumber: move.moveNumber,
        customerId: customer.id,
        customerNumber: customer.customerNumber,
        customerName:
          customer.company || `${customer.firstName} ${customer.lastName}`.trim() || customer.customerNumber,
        originAddress,
        destinationAddress,
        plannedDate: formatPlannedDate(plannedDate),
        status: move.status,
        documentCount: 0,
      },
    });
  } catch (error) {
    console.error("Umzug konnte nicht angelegt werden.", error);
    const isDev = process.env.NODE_ENV !== "production";
    const rawMessage = error instanceof Error ? error.message : "";
    const message = isDev && rawMessage ? `Der Umzug konnte nicht angelegt werden: ${rawMessage}` : "Der Umzug konnte nicht angelegt werden.";
    const status = rawMessage.includes("SFTP ist nicht konfiguriert") ? 422 : 500;
    return NextResponse.json({ message }, { status });
  }
}
