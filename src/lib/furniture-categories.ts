export const furnitureCategories = [
  { id: "bed", label: "Bett" },
  { id: "cabinet", label: "Schrank" },
  { id: "table", label: "Tisch" },
  { id: "seating", label: "Sitzmöbel" },
  { id: "dresser", label: "Kommode" },
  { id: "appliance", label: "Haushaltsgerät" },
  { id: "shelving", label: "Regal" },
  { id: "workshop", label: "Werkstatt" },
  { id: "vehicle", label: "Fahrzeug" },
  { id: "box", label: "Karton" },
  { id: "misc", label: "Sonstiges" },
] as const;

export type FurnitureCategoryId = (typeof furnitureCategories)[number]["id"];

const furnitureCategoryLabelById = new Map(
  furnitureCategories.map((category) => [category.id, category.label] as const),
);

export function isFurnitureCategoryId(value: string): value is FurnitureCategoryId {
  return furnitureCategoryLabelById.has(value as FurnitureCategoryId);
}

export function getFurnitureCategoryLabel(categoryId: FurnitureCategoryId | string) {
  return furnitureCategoryLabelById.get(categoryId as FurnitureCategoryId) ?? "Sonstiges";
}
