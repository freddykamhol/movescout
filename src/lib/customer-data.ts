import "server-only";

import { decryptNullableStringForOrg, decryptStringForOrg } from "@/lib/crypto/data-encryption";
import { listCustomerDocumentFiles } from "@/lib/document-storage";
import { getCurrentOrgKey } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export type CustomerDocumentRecord = {
  category: string;
  id: string;
  title: string;
  updatedAt: string;
};

export type CustomerTableRecord = {
  address: string;
  city: string;
  company: string;
  customerNumber: string;
  documents: CustomerDocumentRecord[];
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  moveCount: number;
  phone: string;
  postalCode: string;
};

function inferDocumentCategory(fileName: string) {
  const normalizedName = fileName.toLowerCase();

  if (normalizedName.includes("angebot")) {
    return "OFFER";
  }

  if (normalizedName.includes("vertrag")) {
    return "CONTRACT";
  }

  if (normalizedName.includes("rechnung")) {
    return "INVOICE";
  }

  if (normalizedName.includes("checkliste") || normalizedName.includes("protokoll")) {
    return "CHECKLIST";
  }

  return "OTHER";
}

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

async function mapCustomerToTableRecord(customer: {
  _count?: { moves: number };
  address: string;
  city: string;
  company: string | null;
  customerNumber: string;
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  phone: string;
  postalCode: string;
}) {
  const orgKey = await getCurrentOrgKey();
  let files: Awaited<ReturnType<typeof listCustomerDocumentFiles>> = [];
  try {
    files = await listCustomerDocumentFiles(customer.customerNumber, orgKey);
  } catch (error) {
    console.warn("Kundendokumente konnten nicht geladen werden.", error);
  }

  return {
    id: customer.id,
    customerNumber: customer.customerNumber,
    company: decryptNullableStringForOrg(orgKey, customer.company) ?? "",
    firstName: decryptStringForOrg(orgKey, customer.firstName),
    lastName: decryptStringForOrg(orgKey, customer.lastName),
    address: decryptStringForOrg(orgKey, customer.address),
    postalCode: decryptStringForOrg(orgKey, customer.postalCode),
    city: decryptStringForOrg(orgKey, customer.city),
    phone: decryptStringForOrg(orgKey, customer.phone),
    email: decryptStringForOrg(orgKey, customer.email),
    moveCount: customer._count?.moves ?? 0,
    documents: files.map((file) => ({
      id: file.relativePath,
      title: file.title,
      category: inferDocumentCategory(file.fileName),
      updatedAt: file.updatedAt,
    })),
  };
}

export async function getCustomerTableData() {
  const prisma = getPrismaClient();

  if (!prisma) {
    return [];
  }

  try {
    const orgKey = await getCurrentOrgKey();
    const customers = await prisma.customer.findMany({
      include: {
        _count: {
          select: {
            moves: true,
          },
        },
      },
      where: {
        orgKey,
      },
    });

    const mapped = await Promise.all(customers.map((customer) => mapCustomerToTableRecord(customer)));
    return mapped.sort((left, right) => {
      const companyCompare = left.company.localeCompare(right.company, "de", { sensitivity: "base" });
      if (companyCompare !== 0) return companyCompare;
      const lastCompare = left.lastName.localeCompare(right.lastName, "de", { sensitivity: "base" });
      if (lastCompare !== 0) return lastCompare;
      return left.firstName.localeCompare(right.firstName, "de", { sensitivity: "base" });
    });
  } catch (error) {
    const errorCode = getErrorCode(error);
    const suffix = errorCode ? ` (${errorCode})` : "";

    console.warn(`Kundendaten konnten nicht geladen werden${suffix}.`);
    return [];
  }
}

export async function getCustomerTableRecordById(customerId: string) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return null;
  }

  const orgKey = await getCurrentOrgKey();
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      orgKey,
    },
    include: {
      _count: {
        select: {
          moves: true,
        },
      },
    },
  });

  if (!customer) {
    return null;
  }

  return mapCustomerToTableRecord(customer);
}
