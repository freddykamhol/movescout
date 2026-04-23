import "server-only";

import { MoveStatus } from "@/generated/prisma/client";
import { decryptNullableStringForOrg, decryptStringForOrg } from "@/lib/crypto/data-encryption";
import { getCurrentOrgKey } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export type DashboardStatRecord = {
  hint: string;
  label: string;
  value: string;
};

export type DashboardListItem = {
  id: string;
  label: string;
  subtitle: string;
};

export type DashboardActivityRecord = {
  id: string;
  text: string;
  time: string;
};

export type DashboardPlannedMoveRecord = {
  customerName: string;
  id: string;
  moveNumber: string;
  plannedDateLabel: string;
  plannedDayIso: string;
  routeLabel: string;
  statusLabel: string;
};

export type DashboardData = {
  latestActivities: DashboardActivityRecord[];
  latestCustomers: DashboardListItem[];
  latestMoves: DashboardListItem[];
  plannedMoves: DashboardPlannedMoveRecord[];
  stats: DashboardStatRecord[];
  totalMoves: number;
};

const numberFormatter = new Intl.NumberFormat("de-DE");
const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const relativeFormatter = new Intl.RelativeTimeFormat("de-DE", {
  numeric: "auto",
});

function createEmptyDashboardData(): DashboardData {
  return {
    totalMoves: 0,
    stats: [
      { label: "Kunden gesamt", value: "0", hint: "in der Datenbank" },
      { label: "Aktive Umzüge", value: "0", hint: "Lead, geplant oder in Arbeit" },
      { label: "Neue Kunden (30 Tage)", value: "0", hint: "in den letzten 30 Tagen" },
    ],
    latestCustomers: [],
    latestMoves: [],
    latestActivities: [],
    plannedMoves: [],
  };
}

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

function getCustomerDisplayName(customer: {
  company: string | null;
  customerNumber: string;
  firstName: string;
  lastName: string;
}, orgKey: string) {
  const company = decryptNullableStringForOrg(orgKey, customer.company) ?? "";
  const firstName = decryptStringForOrg(orgKey, customer.firstName);
  const lastName = decryptStringForOrg(orgKey, customer.lastName);
  return company || `${firstName} ${lastName}`.trim() || customer.customerNumber;
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

  return "Route offen";
}

function formatMoveStatusLabel(status: MoveStatus) {
  if (status === MoveStatus.PLANNED) {
    return "Geplant";
  }

  if (status === MoveStatus.IN_PROGRESS) {
    return "In Arbeit";
  }

  if (status === MoveStatus.COMPLETED) {
    return "Abgeschlossen";
  }

  if (status === MoveStatus.CANCELLED) {
    return "Storniert";
  }

  return "Lead";
}

function formatRelativeTime(date: Date) {
  const diffInMilliseconds = date.getTime() - Date.now();
  const diffInMinutes = Math.round(diffInMilliseconds / 60000);

  if (Math.abs(diffInMinutes) < 1) {
    return "gerade eben";
  }

  if (Math.abs(diffInMinutes) < 60) {
    return relativeFormatter.format(diffInMinutes, "minute");
  }

  const diffInHours = Math.round(diffInMinutes / 60);

  if (Math.abs(diffInHours) < 24) {
    return relativeFormatter.format(diffInHours, "hour");
  }

  const diffInDays = Math.round(diffInHours / 24);
  return relativeFormatter.format(diffInDays, "day");
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function getDashboardData(): Promise<DashboardData> {
  const prisma = getPrismaClient();

  if (!prisma) {
    return createEmptyDashboardData();
  }

  const orgKey = await getCurrentOrgKey();
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const [
      totalMoves,
      totalCustomers,
      activeMoves,
      recentCustomersCount,
      latestCustomers,
      latestMoves,
      recentCustomerUpdates,
      recentMoveUpdates,
      recentDocumentUpdates,
      plannedMoves,
    ] = await Promise.all([
      prisma.move.count({ where: { orgKey } }),
      prisma.customer.count({ where: { orgKey } }),
      prisma.move.count({
        where: {
          orgKey,
          status: {
            in: [MoveStatus.LEAD, MoveStatus.PLANNED, MoveStatus.IN_PROGRESS],
          },
        },
      }),
      prisma.customer.count({
        where: {
          orgKey,
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      prisma.customer.findMany({
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          city: true,
          company: true,
          customerNumber: true,
          firstName: true,
          lastName: true,
        },
        take: 10,
        where: {
          orgKey,
        },
      }),
      prisma.move.findMany({
        include: {
          customer: {
            select: {
              company: true,
              customerNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        where: {
          orgKey,
        },
      }),
      prisma.customer.findMany({
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          company: true,
          customerNumber: true,
          firstName: true,
          id: true,
          lastName: true,
          updatedAt: true,
        },
        take: 6,
        where: {
          orgKey,
        },
      }),
      prisma.move.findMany({
        include: {
          customer: {
            select: {
              company: true,
              customerNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 6,
        where: {
          orgKey,
        },
      }),
      prisma.customerDocument.findMany({
        include: {
          customer: {
            select: {
              company: true,
              customerNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 6,
        where: {
          orgKey,
        },
      }),
      prisma.move.findMany({
        include: {
          customer: {
            select: {
              company: true,
              customerNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          plannedDate: "asc",
        },
        take: 200,
        where: {
          orgKey,
          plannedDate: {
            not: null,
          },
        },
      }),
    ]);

    const decryptCity = (value: string) => decryptStringForOrg(orgKey, value) || "";
    const decryptMoveAddress = (value: string | null | undefined) => (value ? decryptStringForOrg(orgKey, value) : null);

    const dashboardActivities = [
      ...recentCustomerUpdates.map((customer) => ({
        id: `customer-${customer.id}`,
        sortValue: customer.updatedAt.getTime(),
        text: `Kunde ${getCustomerDisplayName(customer, orgKey)} aktualisiert`,
        time: formatRelativeTime(customer.updatedAt),
      })),
      ...recentMoveUpdates.map((move) => ({
        id: `move-${move.id}`,
        sortValue: move.updatedAt.getTime(),
        text: `Umzug ${move.moveNumber} für ${getCustomerDisplayName(move.customer, orgKey)} aktualisiert`,
        time: formatRelativeTime(move.updatedAt),
      })),
      ...recentDocumentUpdates.map((document) => ({
        id: `document-${document.id}`,
        sortValue: document.updatedAt.getTime(),
        text: `Dokument ${document.title} bei ${getCustomerDisplayName(document.customer, orgKey)} aktualisiert`,
        time: formatRelativeTime(document.updatedAt),
      })),
    ]
      .sort((leftSide, rightSide) => rightSide.sortValue - leftSide.sortValue)
      .slice(0, 8)
      .map((activity) => ({
        id: activity.id,
        text: activity.text,
        time: activity.time,
      }));

    return {
      totalMoves,
      stats: [
        {
          label: "Kunden gesamt",
          value: numberFormatter.format(totalCustomers),
          hint: "in der Datenbank",
        },
        {
          label: "Aktive Umzüge",
          value: numberFormatter.format(activeMoves),
          hint: "Lead, geplant oder in Arbeit",
        },
        {
          label: "Neue Kunden (30 Tage)",
          value: numberFormatter.format(recentCustomersCount),
          hint: "in den letzten 30 Tagen",
        },
      ],
      latestCustomers: latestCustomers.map((customer) => ({
        id: customer.id,
        label: getCustomerDisplayName(customer, orgKey),
        subtitle: [customer.customerNumber, decryptCity(customer.city) || "Ort offen"].join(" | "),
      })),
      latestMoves: latestMoves.map((move) => ({
        id: move.id,
        label: `${move.moveNumber} | ${formatMoveRoute(decryptMoveAddress(move.originAddress), decryptMoveAddress(move.destinationAddress))}`,
        subtitle: [
          getCustomerDisplayName(move.customer, orgKey),
          move.plannedDate ? dateFormatter.format(move.plannedDate) : "Noch kein Termin",
          formatMoveStatusLabel(move.status),
        ].join(" | "),
      })),
      latestActivities: dashboardActivities,
      plannedMoves: plannedMoves.map((move) => ({
        id: move.id,
        customerName: getCustomerDisplayName(move.customer, orgKey),
        moveNumber: move.moveNumber,
        plannedDateLabel: dateFormatter.format(move.plannedDate ?? now),
        plannedDayIso: toLocalIsoDate(move.plannedDate ?? now),
        routeLabel: formatMoveRoute(decryptMoveAddress(move.originAddress), decryptMoveAddress(move.destinationAddress)),
        statusLabel: formatMoveStatusLabel(move.status),
      })),
    };
  } catch (error) {
    const errorCode = getErrorCode(error);
    const suffix = errorCode ? ` (${errorCode})` : "";

    console.warn(`Dashboarddaten konnten nicht geladen werden${suffix}.`);
    return createEmptyDashboardData();
  }
}
