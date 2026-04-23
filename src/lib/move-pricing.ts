export type MovePricingConfig = {
  assemblyPricePerItem: number;
  bubbleWrapSheetPrice: number;
  ceilingHeightSurcharge: number;
  ceilingLampInstallPricePerItem: number;
  countertopCuttingPricePerItem: number;
  curtainRodHolePricePerItem: number;
  disassemblyPricePerItem: number;
  disposalPricePerCubicMeter: number;
  elevatorFlatFee: number;
  freeWalkingDistanceMeters: number;
  floorPricePerLevel: number;
  furnitureCubicMeterDecimalPrice: number;
  furnitureCubicMeterFullPrice: number;
  kitchenAssemblyPricePerMeter: number;
  kitchenDisassemblyPricePerMeter: number;
  kitchenRebuildPricePerMeter: number;
  packingPackPricePerItem: number;
  packingUnpackPricePerItem: number;
  stretchFilmPricePerMeter: number;
  movingBoxPrice: number;
  bookBoxPrice: number;
  wardrobeBoxPrice: number;
  applianceConnectionPricePerItem: number;
  noParkingZoneFlatFee: number;
  pricePerKilometer: number;
  walkingDistanceStepMeters: number;
  walkingDistanceStepPrice: number;
};

export type MovePricingFieldKey = keyof MovePricingConfig;

type MovePricingFieldDefinition = {
  description: string;
  label: string;
  step: string;
  unit: string;
};

export const defaultMovePricingConfig: MovePricingConfig = {
  assemblyPricePerItem: 40,
  bubbleWrapSheetPrice: 3,
  ceilingHeightSurcharge: 100,
  ceilingLampInstallPricePerItem: 20,
  countertopCuttingPricePerItem: 200,
  curtainRodHolePricePerItem: 2.5,
  disassemblyPricePerItem: 40,
  disposalPricePerCubicMeter: 35,
  elevatorFlatFee: 10,
  freeWalkingDistanceMeters: 10,
  floorPricePerLevel: 10,
  furnitureCubicMeterDecimalPrice: 30,
  furnitureCubicMeterFullPrice: 60,
  kitchenAssemblyPricePerMeter: 120,
  kitchenDisassemblyPricePerMeter: 70,
  kitchenRebuildPricePerMeter: 230,
  packingPackPricePerItem: 6,
  packingUnpackPricePerItem: 3,
  stretchFilmPricePerMeter: 6,
  movingBoxPrice: 2.5,
  bookBoxPrice: 3.5,
  wardrobeBoxPrice: 13,
  applianceConnectionPricePerItem: 50,
  noParkingZoneFlatFee: 200,
  pricePerKilometer: 3,
  walkingDistanceStepMeters: 10,
  walkingDistanceStepPrice: 20,
};

export const movePricingFields: Record<MovePricingFieldKey, MovePricingFieldDefinition> = {
  assemblyPricePerItem: {
    label: "Aufbau pro Möbelstück",
    description: "Wird pro markiertem Möbelstück für Aufbau berechnet.",
    step: "0.01",
    unit: "EUR",
  },
  ceilingLampInstallPricePerItem: {
    label: "Deckenlampen montieren",
    description: "Preis pro montierter Deckenlampe.",
    step: "0.01",
    unit: "EUR / Stk",
  },
  ceilingHeightSurcharge: {
    label: "Deckenhöhe > 2,3m Zuschlag",
    description: "Einmaliger Zuschlag, wenn Deckenhöhe über 2,3m.",
    step: "0.01",
    unit: "EUR",
  },
  curtainRodHolePricePerItem: {
    label: "Gardinenstange: Löcher bohren",
    description: "Preis pro gebohrtem Loch.",
    step: "0.01",
    unit: "EUR / Loch",
  },
  disassemblyPricePerItem: {
    label: "Abbau pro Möbelstück",
    description: "Wird pro markiertem Möbelstück für Abbau berechnet.",
    step: "0.01",
    unit: "EUR",
  },
  disposalPricePerCubicMeter: {
    label: "Entrümpelung pro m3",
    description: "Preis für entsorgtes Möbelvolumen.",
    step: "0.01",
    unit: "EUR / m3",
  },
  elevatorFlatFee: {
    label: "Aufzug pauschal",
    description: "Fixpreis pro Adresse, wenn ein Aufzug vorhanden ist.",
    step: "0.01",
    unit: "EUR",
  },
  freeWalkingDistanceMeters: {
    label: "Freie Laufstrecke",
    description: "Meter ohne zusätzliche Berechnung pro Adresse.",
    step: "0.01",
    unit: "m",
  },
  floorPricePerLevel: {
    label: "Stockwerk pro Ebene",
    description: "Preis pro Etage ohne Aufzug.",
    step: "0.01",
    unit: "EUR",
  },
  furnitureCubicMeterDecimalPrice: {
    label: "Anbruch je Rest-m3",
    description: "Pauschale für angefangene Kubikmeter.",
    step: "0.01",
    unit: "EUR",
  },
  furnitureCubicMeterFullPrice: {
    label: "Voller m3 Möbelvolumen",
    description: "Preis pro vollständig erreichtem Kubikmeter.",
    step: "0.01",
    unit: "EUR / m3",
  },
  packingUnpackPricePerItem: {
    label: "Auspacken pro Einheit",
    description: "Servicepreis pro Karton/Einheit fürs Auspacken.",
    step: "0.01",
    unit: "EUR / Stk",
  },
  packingPackPricePerItem: {
    label: "Einpacken pro Einheit",
    description: "Servicepreis pro Karton/Einheit fürs Einpacken.",
    step: "0.01",
    unit: "EUR / Stk",
  },
  movingBoxPrice: {
    label: "Umzugskarton",
    description: "Materialpreis pro Umzugskarton.",
    step: "0.01",
    unit: "EUR / Stk",
  },
  bookBoxPrice: {
    label: "Bücherkarton",
    description: "Materialpreis pro Bücherkarton.",
    step: "0.01",
    unit: "EUR / Stk",
  },
  wardrobeBoxPrice: {
    label: "Kleiderkarton",
    description: "Materialpreis pro Kleiderkarton.",
    step: "0.01",
    unit: "EUR / Stk",
  },
  stretchFilmPricePerMeter: {
    label: "Stretchfolie",
    description: "Materialpreis pro laufendem Meter Stretchfolie.",
    step: "0.01",
    unit: "EUR / lfm",
  },
  bubbleWrapSheetPrice: {
    label: "Luftpolsterfolie 1x1m",
    description: "Materialpreis pro 1x1m Stück Luftpolsterfolie.",
    step: "0.01",
    unit: "EUR / Stk",
  },
  kitchenDisassemblyPricePerMeter: {
    label: "Küche: Abbau",
    description: "Preis pro Laufmeter Küchenabbau.",
    step: "0.01",
    unit: "EUR / m",
  },
  kitchenAssemblyPricePerMeter: {
    label: "Küche: Aufbau",
    description: "Preis pro Laufmeter Küchenaufbau.",
    step: "0.01",
    unit: "EUR / m",
  },
  kitchenRebuildPricePerMeter: {
    label: "Küche: Neuaufbau",
    description: "Preis pro Laufmeter Küchenneuaufbau.",
    step: "0.01",
    unit: "EUR / m",
  },
  applianceConnectionPricePerItem: {
    label: "E-Geräte anschließen",
    description: "Preis pro angeschlossenem Elektrogerät.",
    step: "0.01",
    unit: "EUR / Stk",
  },
  countertopCuttingPricePerItem: {
    label: "Arbeitsplatte zuschneiden",
    description: "Preis pro zugeschnittener Arbeitsplatte.",
    step: "0.01",
    unit: "EUR / Platte",
  },
  noParkingZoneFlatFee: {
    label: "Halteverbotszone pauschal",
    description: "Fixpreis pro Adresse mit Halteverbotszone.",
    step: "0.01",
    unit: "EUR",
  },
  pricePerKilometer: {
    label: "Fahrstrecke pro km",
    description: "Preis pro gefahrenem Kilometer.",
    step: "0.01",
    unit: "EUR / km",
  },
  walkingDistanceStepMeters: {
    label: "Laufweg je Schritt",
    description: "Abrechnungsintervall für zusätzliche Laufmeter.",
    step: "0.01",
    unit: "m",
  },
  walkingDistanceStepPrice: {
    label: "Preis je Laufweg-Schritt",
    description: "Preis für jedes angebrochene Laufweg-Intervall.",
    step: "0.01",
    unit: "EUR",
  },
};

export const movePricingSections = [
  {
    id: "route",
    title: "Strecke und Zugang",
    description: "Alle Preise für Fahrstrecke, Laufweg, Stockwerke und Halteverbotszone.",
    fields: [
      "pricePerKilometer",
      "freeWalkingDistanceMeters",
      "walkingDistanceStepMeters",
      "walkingDistanceStepPrice",
      "floorPricePerLevel",
      "elevatorFlatFee",
      "noParkingZoneFlatFee",
    ],
  },
  {
    id: "furniture",
    title: "Möbel und Volumen",
    description: "Grundpreise für Volumenberechnung und Entrümpelung.",
    fields: [
      "furnitureCubicMeterFullPrice",
      "furnitureCubicMeterDecimalPrice",
      "disposalPricePerCubicMeter",
    ],
  },
  {
    id: "services",
    title: "Zusatzleistungen",
    description: "Preise für manuell markierte Serviceleistungen pro Möbelstück.",
    fields: ["assemblyPricePerItem", "disassemblyPricePerItem"],
  },
  {
    id: "handyman",
    title: "Handwerk",
    description: "Optionale Handwerksleistungen (Lampen, Bohren).",
    fields: ["ceilingLampInstallPricePerItem", "ceilingHeightSurcharge", "curtainRodHolePricePerItem"],
  },
  {
    id: "packing",
    title: "Verpackungsmaterial",
    description: "Materialpreise sowie Ein-/Auspackservice pro Einheit.",
    fields: [
      "packingUnpackPricePerItem",
      "packingPackPricePerItem",
      "movingBoxPrice",
      "bookBoxPrice",
      "wardrobeBoxPrice",
      "stretchFilmPricePerMeter",
      "bubbleWrapSheetPrice",
    ],
  },
  {
    id: "kitchen",
    title: "Küchenleistungen",
    description: "Küche demontieren/aufbauen sowie Geräte und Arbeitsplatten.",
    fields: [
      "kitchenDisassemblyPricePerMeter",
      "kitchenAssemblyPricePerMeter",
      "kitchenRebuildPricePerMeter",
      "applianceConnectionPricePerItem",
      "countertopCuttingPricePerItem",
    ],
  },
] as const satisfies ReadonlyArray<{
  description: string;
  fields: readonly MovePricingFieldKey[];
  id: string;
  title: string;
}>;

function parseMovePricingNumber(value: unknown, fallbackValue: number) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : fallbackValue;
  }

  if (typeof value !== "string") {
    return fallbackValue;
  }

  const normalizedValue = value.trim().replace(",", ".");

  if (!normalizedValue) {
    return fallbackValue;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallbackValue;
}

export function normalizeMovePricingConfig(input: Partial<Record<MovePricingFieldKey, unknown>> | null | undefined): MovePricingConfig {
  return {
    assemblyPricePerItem: parseMovePricingNumber(input?.assemblyPricePerItem, defaultMovePricingConfig.assemblyPricePerItem),
    bubbleWrapSheetPrice: parseMovePricingNumber(input?.bubbleWrapSheetPrice, defaultMovePricingConfig.bubbleWrapSheetPrice),
    ceilingHeightSurcharge: parseMovePricingNumber(input?.ceilingHeightSurcharge, defaultMovePricingConfig.ceilingHeightSurcharge),
    ceilingLampInstallPricePerItem: parseMovePricingNumber(
      input?.ceilingLampInstallPricePerItem,
      defaultMovePricingConfig.ceilingLampInstallPricePerItem,
    ),
    countertopCuttingPricePerItem: parseMovePricingNumber(
      input?.countertopCuttingPricePerItem,
      defaultMovePricingConfig.countertopCuttingPricePerItem,
    ),
    curtainRodHolePricePerItem: parseMovePricingNumber(
      input?.curtainRodHolePricePerItem,
      defaultMovePricingConfig.curtainRodHolePricePerItem,
    ),
    disassemblyPricePerItem: parseMovePricingNumber(input?.disassemblyPricePerItem, defaultMovePricingConfig.disassemblyPricePerItem),
    disposalPricePerCubicMeter: parseMovePricingNumber(
      input?.disposalPricePerCubicMeter,
      defaultMovePricingConfig.disposalPricePerCubicMeter,
    ),
    elevatorFlatFee: parseMovePricingNumber(input?.elevatorFlatFee, defaultMovePricingConfig.elevatorFlatFee),
    freeWalkingDistanceMeters: parseMovePricingNumber(
      input?.freeWalkingDistanceMeters,
      defaultMovePricingConfig.freeWalkingDistanceMeters,
    ),
    floorPricePerLevel: parseMovePricingNumber(input?.floorPricePerLevel, defaultMovePricingConfig.floorPricePerLevel),
    furnitureCubicMeterDecimalPrice: parseMovePricingNumber(
      input?.furnitureCubicMeterDecimalPrice,
      defaultMovePricingConfig.furnitureCubicMeterDecimalPrice,
    ),
    furnitureCubicMeterFullPrice: parseMovePricingNumber(
      input?.furnitureCubicMeterFullPrice,
      defaultMovePricingConfig.furnitureCubicMeterFullPrice,
    ),
    kitchenAssemblyPricePerMeter: parseMovePricingNumber(
      input?.kitchenAssemblyPricePerMeter,
      defaultMovePricingConfig.kitchenAssemblyPricePerMeter,
    ),
    kitchenDisassemblyPricePerMeter: parseMovePricingNumber(
      input?.kitchenDisassemblyPricePerMeter,
      defaultMovePricingConfig.kitchenDisassemblyPricePerMeter,
    ),
    kitchenRebuildPricePerMeter: parseMovePricingNumber(input?.kitchenRebuildPricePerMeter, defaultMovePricingConfig.kitchenRebuildPricePerMeter),
    packingPackPricePerItem: parseMovePricingNumber(input?.packingPackPricePerItem, defaultMovePricingConfig.packingPackPricePerItem),
    packingUnpackPricePerItem: parseMovePricingNumber(input?.packingUnpackPricePerItem, defaultMovePricingConfig.packingUnpackPricePerItem),
    stretchFilmPricePerMeter: parseMovePricingNumber(input?.stretchFilmPricePerMeter, defaultMovePricingConfig.stretchFilmPricePerMeter),
    movingBoxPrice: parseMovePricingNumber(input?.movingBoxPrice, defaultMovePricingConfig.movingBoxPrice),
    bookBoxPrice: parseMovePricingNumber(input?.bookBoxPrice, defaultMovePricingConfig.bookBoxPrice),
    wardrobeBoxPrice: parseMovePricingNumber(input?.wardrobeBoxPrice, defaultMovePricingConfig.wardrobeBoxPrice),
    applianceConnectionPricePerItem: parseMovePricingNumber(
      input?.applianceConnectionPricePerItem,
      defaultMovePricingConfig.applianceConnectionPricePerItem,
    ),
    noParkingZoneFlatFee: parseMovePricingNumber(input?.noParkingZoneFlatFee, defaultMovePricingConfig.noParkingZoneFlatFee),
    pricePerKilometer: parseMovePricingNumber(input?.pricePerKilometer, defaultMovePricingConfig.pricePerKilometer),
    walkingDistanceStepMeters: parseMovePricingNumber(
      input?.walkingDistanceStepMeters,
      defaultMovePricingConfig.walkingDistanceStepMeters,
    ),
    walkingDistanceStepPrice: parseMovePricingNumber(
      input?.walkingDistanceStepPrice,
      defaultMovePricingConfig.walkingDistanceStepPrice,
    ),
  };
}
