import "server-only";

import { listMoveDocumentFiles } from "@/lib/document-storage";
import { decryptStringForOrg } from "@/lib/crypto/data-encryption";
import { getCurrentOrgKey } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export type MoveRecord = {
  customerId: string;
  customerName: string;
  customerNumber: string;
  destinationAddress: string;
  documentCount: number;
  id: string;
  moveNumber: string;
  originAddress: string;
  plannedDate: string;
  plannedEndDate: string | null;
  status: string;
};

function formatDate(date: Date | null | undefined) {
  if (!date) {
    return "Noch kein Termin";
  }

  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(date: Date | null | undefined) {
  if (!date) return "";
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function formatScheduleLabel(start: Date | null | undefined, end: Date | null | undefined) {
  if (!start) return "Noch kein Termin";
  const dateLabel = formatDate(start);
  const startTime = formatTime(start);
  const endTime = formatTime(end);
  if (startTime && endTime) return `${dateLabel} ${startTime}–${endTime}`;
  if (startTime) return `${dateLabel} ${startTime}`;
  return dateLabel;
}

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

async function mapMoveToRecord(move: {
  customer: {
    company: string | null;
    customerNumber: string;
    firstName: string;
    id: string;
    lastName: string;
  };
  destinationAddress: string | null;
  id: string;
  moveNumber: string;
  originAddress: string | null;
  plannedDate: Date | null;
  plannedEndDate: Date | null;
  status: string;
}) {
  const orgKey = await getCurrentOrgKey();
  let files: Awaited<ReturnType<typeof listMoveDocumentFiles>> = [];
  try {
    files = await listMoveDocumentFiles(move.customer.customerNumber, move.moveNumber, orgKey);
  } catch (error) {
    console.warn("Umzugsdokumente konnten nicht geladen werden.", error);
  }
  const customerName =
    move.customer.company || `${move.customer.firstName} ${move.customer.lastName}`.trim() || move.customer.customerNumber;

  return {
    id: move.id,
    moveNumber: move.moveNumber,
    customerId: move.customer.id,
    customerNumber: move.customer.customerNumber,
    customerName,
    originAddress: move.originAddress ? decryptStringForOrg(orgKey, move.originAddress) : "Start offen",
    destinationAddress: move.destinationAddress ? decryptStringForOrg(orgKey, move.destinationAddress) : "Ziel offen",
    plannedDate: formatScheduleLabel(move.plannedDate, move.plannedEndDate),
    plannedEndDate: move.plannedEndDate ? move.plannedEndDate.toISOString() : null,
    status: move.status,
    documentCount: files.length,
  };
}

export async function getMoveTableData() {
  const prisma = getPrismaClient();

  if (!prisma) {
    return [];
  }

  try {
    const orgKey = await getCurrentOrgKey();
    const moves = await prisma.move.findMany({
      include: {
        customer: {
          select: {
            company: true,
            customerNumber: true,
            firstName: true,
            id: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ plannedDate: "desc" }, { createdAt: "desc" }],
      where: {
        orgKey,
      },
    });

    return Promise.all(moves.map((move) => mapMoveToRecord(move)));
  } catch (error) {
    const errorCode = getErrorCode(error);
    const suffix = errorCode ? ` (${errorCode})` : "";

    console.warn(`Umzugsdaten konnten nicht geladen werden${suffix}.`);
    return [];
  }
}

export async function getMoveRecordById(moveId: string) {
  const prisma = getPrismaClient();

  if (!prisma) {
    return null;
  }

  const orgKey = await getCurrentOrgKey();
  const move = await prisma.move.findFirst({
    where: {
      id: moveId,
      orgKey,
    },
    include: {
      customer: {
        select: {
          company: true,
          customerNumber: true,
          firstName: true,
          id: true,
          lastName: true,
        },
      },
    },
  });

  if (!move) {
    return null;
  }

  return mapMoveToRecord(move);
}
