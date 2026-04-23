import "server-only";

import { decryptNullableStringForOrg, decryptStringForOrg } from "@/lib/crypto/data-encryption";
import { ensureCustomerDocumentStructure, ensureMoveDocumentStructure, listCustomerDocumentFiles, listMoveDocumentFiles } from "@/lib/document-storage";
import { getCurrentOrgKey } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export type DocumentLibraryDocumentRecord = {
  category: string;
  fileName: string;
  fileUrl: string;
  id: string;
  title: string;
  updatedAt: string;
};

export type DocumentLibraryMoveRecord = {
  documents: DocumentLibraryDocumentRecord[];
  documentCount: number;
  id: string;
  moveNumber: string;
  routeLabel: string;
  scheduleLabel: string;
  status: string;
};

export type DocumentLibraryCustomerRecord = {
  address: string;
  city: string;
  company: string;
  customerNumber: string;
  documents: DocumentLibraryDocumentRecord[];
  email: string;
  firstName: string;
  id: string;
  lastName: string;
  moves: DocumentLibraryMoveRecord[];
  phone: string;
  postalCode: string;
};

function resolveOrgKey(orgKey: string | undefined | null) {
  const trimmed = orgKey?.trim() ?? "";
  return trimmed || null;
}

function formatDate(date: Date | null | undefined) {
  if (!date) {
    return "Kein Datum";
  }

  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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

function buildDocumentFileUrl(relativePath: string) {
  return `/api/documents/file?path=${encodeURIComponent(relativePath)}`;
}

function formatMoveRoute(originAddress: string | null | undefined, destinationAddress: string | null | undefined) {
  const from = originAddress?.trim();
  const to = destinationAddress?.trim();

  if (from && to) {
    return `${from} -> ${to}`;
  }

  if (from) {
    return `Start: ${from}`;
  }

  if (to) {
    return `Ziel: ${to}`;
  }

  return "Route noch offen";
}

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

export async function getDocumentLibraryData(orgKey?: string) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return [];
  }

  try {
    const resolvedOrgKey = resolveOrgKey(orgKey) ?? (await getCurrentOrgKey());
    const customers = await prisma.customer.findMany({
      include: {
        moves: {
          orderBy: [{ plannedDate: "desc" }, { createdAt: "desc" }],
        },
      },
      where: {
        orgKey: resolvedOrgKey,
      },
    });

    const mapped = await Promise.all(
      customers.map(async (customer) => {
        let customerFiles: Awaited<ReturnType<typeof listCustomerDocumentFiles>> = [];
        try {
          await ensureCustomerDocumentStructure(customer.customerNumber, resolvedOrgKey);
          customerFiles = await listCustomerDocumentFiles(customer.customerNumber, resolvedOrgKey);
        } catch (error) {
          console.warn("Kundendokumente konnten nicht geladen werden.", error);
        }
        const moveRecords = await Promise.all(
          customer.moves.map(async (move) => {
            let moveFiles: Awaited<ReturnType<typeof listMoveDocumentFiles>> = [];
            try {
              await ensureMoveDocumentStructure(customer.customerNumber, move.moveNumber, resolvedOrgKey);
              moveFiles = await listMoveDocumentFiles(customer.customerNumber, move.moveNumber, resolvedOrgKey);
            } catch (error) {
              console.warn("Umzugsdokumente konnten nicht geladen werden.", error);
            }

            return {
              documents: moveFiles.map((file) => ({
                id: file.relativePath,
                title: file.title,
                category: inferDocumentCategory(file.fileName),
                updatedAt: file.updatedAt,
                fileName: file.fileName,
                fileUrl: buildDocumentFileUrl(file.relativePath),
              })),
              id: move.id,
              moveNumber: move.moveNumber,
              routeLabel: formatMoveRoute(
                move.originAddress ? decryptStringForOrg(resolvedOrgKey, move.originAddress) : null,
                move.destinationAddress ? decryptStringForOrg(resolvedOrgKey, move.destinationAddress) : null,
              ),
              scheduleLabel: move.plannedDate ? formatDate(move.plannedDate) : "Noch kein Termin",
              status: move.status,
              documentCount: moveFiles.length,
            };
          }),
        );

        return {
          id: customer.id,
          customerNumber: customer.customerNumber,
          company: decryptNullableStringForOrg(resolvedOrgKey, customer.company) ?? "",
          firstName: decryptStringForOrg(resolvedOrgKey, customer.firstName),
          lastName: decryptStringForOrg(resolvedOrgKey, customer.lastName),
          address: decryptStringForOrg(resolvedOrgKey, customer.address),
          postalCode: decryptStringForOrg(resolvedOrgKey, customer.postalCode),
          city: decryptStringForOrg(resolvedOrgKey, customer.city),
          phone: decryptStringForOrg(resolvedOrgKey, customer.phone),
          email: decryptStringForOrg(resolvedOrgKey, customer.email),
          documents: customerFiles.map((file) => ({
            id: file.relativePath,
            title: file.title,
            category: inferDocumentCategory(file.fileName),
            updatedAt: file.updatedAt,
            fileName: file.fileName,
            fileUrl: buildDocumentFileUrl(file.relativePath),
          })),
          moves: moveRecords,
        };
      }),
    );
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

    console.warn(`Dokumentenbibliothek konnte nicht geladen werden${suffix}.`);
    return [];
  }
}
