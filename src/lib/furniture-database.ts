import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { isFurnitureCategoryId, type FurnitureCategoryId } from "@/lib/furniture-categories";
import { furnitureCatalog } from "@/lib/furniture-catalog";
import { getCurrentOrgKey } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export type FurnitureDatabaseRecord = {
  category: FurnitureCategoryId;
  furnitureName: string;
  heightCm: number;
  id?: string;
  lengthCm: number;
  rooms: string[];
  standardRooms: string[];
  widthCm: number;
};

const furnitureCsvPath = path.join(process.cwd(), "prisma", "data", "furniture-database.csv");
const furnitureCategoryByName = new Map(
  furnitureCatalog.map((catalogItem) => [catalogItem.furnitureName, catalogItem.category] as const),
);

function splitCommaSeparatedValues(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseDimension(value: string, fieldName: "L" | "B" | "H", furnitureName: string) {
  const normalizedValue = value.trim().replace(",", ".");
  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Ungueltiger ${fieldName}-Wert fuer ${furnitureName || "Unbekannt"}.`);
  }

  return parsedValue;
}

function parseFurnitureCsvRow(row: string) {
  const columns = row.split(";");

  if (columns.length !== 7) {
    throw new Error(`Ungueltige Zeile in der Moebel-Datenbank: ${row}`);
  }

  const [furnitureName, categoryValue, lengthValue, widthValue, heightValue, standardRoomsValue, roomsValue] = columns.map((column) =>
    column.trim(),
  );

  if (!furnitureName) {
    throw new Error(`Moebelstueck-Name fehlt in der Zeile: ${row}`);
  }

  if (!isFurnitureCategoryId(categoryValue)) {
    throw new Error(`Unbekannte Kategorie fuer ${furnitureName || "Unbekannt"}: ${categoryValue}`);
  }

  return {
    category: categoryValue,
    furnitureName,
    lengthCm: parseDimension(lengthValue, "L", furnitureName),
    widthCm: parseDimension(widthValue, "B", furnitureName),
    heightCm: parseDimension(heightValue, "H", furnitureName),
    standardRooms: splitCommaSeparatedValues(standardRoomsValue),
    rooms: splitCommaSeparatedValues(roomsValue),
  } satisfies FurnitureDatabaseRecord;
}

export async function loadFurnitureDatabaseFromCsv() {
  const rawCsv = await readFile(furnitureCsvPath, "utf8");
  const rows = rawCsv
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  return rows.slice(1).map(parseFurnitureCsvRow);
}

export async function getFurnitureDatabase() {
  const prisma = getPrismaClient();

  if (prisma) {
    try {
      const orgKey = await getCurrentOrgKey();
      const furnitureItems = await prisma.furnitureItem.findMany({
        orderBy: {
          furnitureName: "asc",
        },
        where: {
          orgKey,
        },
      });

      if (furnitureItems.length > 0) {
        return furnitureItems.map((item) => ({
          id: item.id,
          category: furnitureCategoryByName.get(item.furnitureName) ?? "misc",
          furnitureName: item.furnitureName,
          lengthCm: item.lengthCm,
          widthCm: item.widthCm,
          heightCm: item.heightCm,
          standardRooms: item.standardRooms,
          rooms: item.rooms,
        })) satisfies FurnitureDatabaseRecord[];
      }
    } catch (error) {
      console.warn("Moebel-Datenbank konnte nicht aus Prisma geladen werden. CSV-Fallback wird verwendet.", error);
    }
  }

  return loadFurnitureDatabaseFromCsv();
}
