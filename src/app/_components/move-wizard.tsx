"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRightLeft,
  Archive,
  Baby,
  Bath,
  BedDouble,
  BedSingle,
  Building2,
  CarFront,
  ChevronDown,
  CircleParking,
  CookingPot,
  House,
  MapPin,
  Plus,
  Route,
  Search,
  ShowerHead,
  Sofa,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import { getPageChrome } from "@/app/_components/page-styles";
import { furnitureCategories, getFurnitureCategoryLabel, type FurnitureCategoryId } from "@/lib/furniture-categories";
import { furnitureCatalog, type FurnitureCatalogItem } from "@/lib/furniture-catalog";
import { defaultMovePricingConfig, type MovePricingConfig } from "@/lib/move-pricing";
import {
  getMoveCalculationReadiness,
  hasAnyAddressData,
  type MoveCalculationAddressInput,
  type MoveCalculationAddressKind,
  type MoveCalculationErrorResponse,
  type MoveCalculationFurnitureInput,
  type MoveCalculationReadyResponse,
  type MoveCalculationRequest,
  type MoveCalculationResponse,
} from "@/lib/move-calculation";

type MoveWizardContextValue = {
  openMoveWizard: (options?: MoveWizardOpenOptions) => void;
};

type MoveWizardProviderProps = {
  children: ReactNode;
  lightMode: boolean;
};

type MoveWizardOpenOptions = {
  customerId?: string;
  customerPrefill?: MoveWizardCustomerPrefill;
  moveId?: string;
  onCreated?: () => void;
  sourceLabel?: string;
};

type MoveWizardCustomerPrefill = {
  city?: string;
  company?: string;
  customerNumber?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  postalCode?: string;
  street?: string;
};

type MoveWizardSession = {
  id: number;
  options?: MoveWizardOpenOptions;
};

type MoveApiResponse = {
  message?: string;
  move?: {
    customerId: string;
    customerName: string;
    customerNumber: string;
    destinationAddress: string;
    documentCount: number;
    id: string;
    moveNumber: string;
    originAddress: string;
    plannedDate: string;
    status: string;
  };
};

type MoveDetailsApiResponse = {
  message?: string;
  move?: {
    id: string;
    moveNumber: string;
    status: string;
    originAddress: string | null;
    destinationAddress: string | null;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    wizardData: unknown;
    pricingSummary: unknown;
    customer: {
      id: string;
      customerNumber: string;
      name: string;
      company: string | null;
      firstName: string;
      lastName: string;
      address: string;
      postalCode: string;
      city: string;
      email: string;
      phone: string;
    };
  };
};

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  let rawText = "";

  try {
    rawText = await response.text();
  } catch {
    return null;
  }

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
}

async function readJsonResponseOrThrow<T>(response: Response): Promise<T> {
  const parsed = await readJsonResponse<T>(response);
  if (!parsed) {
    throw new Error(`Unerwartete Serverantwort (${response.status}).`);
  }
  return parsed;
}

type CustomerStepData = {
  city: string;
  company: string;
  email: string;
  houseNumber: string;
  lastName: string;
  firstName: string;
  postalCode: string;
  salutation: string;
  street: string;
};

type AddressSectionData = {
  city: string;
  floor: string;
  hasElevator: boolean;
  hasNoParkingZone: boolean;
  houseNumber: string;
  id: string;
  parkingSituation: string;
  postalCode: string;
  street: string;
  walkingDistanceMeters: string;
  livingAreaCubicMeters: string;
};

type PackingMaterialKey = "movingBox" | "bookBox" | "wardrobeBox" | "stretchFilm" | "bubbleWrap";

type PackingMaterialSelection = {
  pack: boolean;
  quantity: string;
  unpack: boolean;
};

type ExtrasHandymanData = {
  ceilingHeightOver23m: boolean;
  ceilingLampCount: string;
  curtainRodHoleCount: string;
};

type ExtrasStepData = {
  handyman: ExtrasHandymanData;
  packing: Record<PackingMaterialKey, PackingMaterialSelection>;
};

type KitchenStepData = {
  applianceCount: string;
  countertopCount: string;
  kitchenMeters: string;
  optionApplianceConnect: boolean;
  optionAssembly: boolean;
  optionCountertopCutting: boolean;
  optionDisassembly: boolean;
  optionRebuild: boolean;
};

type MoveWizardData = {
  customer: CustomerStepData;
  extras: ExtrasStepData;
  furnitureSelections: FurnitureSelectionData[];
  kitchen: KitchenStepData;
  plannedDate: string;
  moveInAddress: AddressSectionData;
  moveOutAddress: AddressSectionData;
  roomSelections: string[];
  stopAddresses: AddressSectionData[];
};

type WizardStep = {
  description: string;
  hidden?: boolean;
  id: string;
  title: string;
};

type RoomOption = {
  icon: LucideIcon;
  id: string;
  label: string;
};

type AddressSectionKind = "move-in" | "move-out" | "stop";
type LocationSnapshot = Pick<CustomerStepData, "city" | "houseNumber" | "postalCode" | "street">;
type FurnitureSelectionData = {
  category: FurnitureCategoryId;
  catalogItemId: string;
  furnitureName: string;
  heightCm: string;
  id: string;
  isAssembly: boolean;
  isDisassembly: boolean;
  isDisposal: boolean;
  lengthCm: string;
  room: string;
  widthCm: string;
};

type AddressField = Exclude<keyof AddressSectionData, "hasElevator" | "hasNoParkingZone" | "id">;
type BooleanAddressField = Extract<keyof AddressSectionData, "hasElevator" | "hasNoParkingZone">;
type CustomerField = keyof CustomerStepData;
type FurnitureBooleanField = Extract<keyof FurnitureSelectionData, "isAssembly" | "isDisassembly" | "isDisposal">;
type FurnitureDimensionField = Extract<keyof FurnitureSelectionData, "heightCm" | "lengthCm" | "widthCm">;
type MoveCalculationUiState = {
  data: MoveCalculationReadyResponse | null;
  message: string;
  status: "error" | "idle" | "loading" | "ready";
  warnings: string[];
};

const baseWizardSteps: WizardStep[] = [
  { id: "customer", title: "Kundendaten", description: "Firma, Anrede und Kontaktadresse" },
  { id: "addresses", title: "Adressen", description: "Auszug, Zwischenstopps und Einzug" },
  { id: "rooms", title: "Raumauswahl", description: "Relevante Bereiche auswählen" },
  { id: "furniture", title: "Möbelauswahl", description: "Möbel pro Raum erfassen und Leistungen markieren" },
  { id: "extras", title: "Zusatzleistungen", description: "Handwerk und Verpackungsmaterial" },
  { id: "kitchen", title: "Küchenleistungen", description: "Küche, Arbeitsplatten und E-Geräte" },
  { id: "summary", title: "Zusammenfassung", description: "Alle Posten und Gesamtsumme" },
  { id: "downloads", title: "Downloads", description: "PDFs herunterladen", hidden: true },
];

const floorOptions = ["Unbekannt", "EG", "1. OG", "2. OG", "3. OG", "4. OG", "5. OG", "6. OG oder höher"];
const priceFormatter = new Intl.NumberFormat("de-DE", {
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  style: "currency",
});

const roomOptions = [
  { id: "bedroom", label: "Schlafzimmer", icon: BedDouble },
  { id: "living-room", label: "Wohnzimmer", icon: Sofa },
  { id: "guest-room", label: "Gästezimmer", icon: BedSingle },
  { id: "child-room", label: "Kinderzimmer", icon: Baby },
  { id: "kitchen", label: "Küche", icon: CookingPot },
  { id: "bathroom", label: "Badezimmer", icon: Bath },
  { id: "guest-bathroom", label: "Gäste-Bad", icon: ShowerHead },
  { id: "basement", label: "Keller", icon: Archive },
  { id: "attic", label: "Dachboden", icon: House },
  { id: "garage", label: "Garage", icon: CarFront },
] as const satisfies readonly RoomOption[];

const MoveWizardContext = createContext<MoveWizardContextValue | null>(null);

function createFurnitureOptionKey(catalogItemId: string, room: string) {
  return `${catalogItemId}::${room}`;
}

function getRoomLabelsFromSelectionIds(roomSelectionIds: string[]) {
  return roomOptions.filter((room) => roomSelectionIds.includes(room.id)).map((room) => room.label);
}

function createFurnitureSelection(catalogItem: FurnitureCatalogItem, room: string): FurnitureSelectionData {
  return {
    category: catalogItem.category,
    id: globalThis.crypto?.randomUUID?.() ?? `furniture-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    catalogItemId: catalogItem.id,
    furnitureName: catalogItem.furnitureName,
    room,
    lengthCm: String(catalogItem.lengthCm),
    widthCm: String(catalogItem.widthCm),
    heightCm: String(catalogItem.heightCm),
    isDisposal: false,
    isAssembly: false,
    isDisassembly: false,
  };
}

function countFilledAddressDetails(address: AddressSectionData) {
  return [
    address.street,
    address.houseNumber,
    address.postalCode,
    address.city,
    address.livingAreaCubicMeters,
    address.walkingDistanceMeters,
    address.parkingSituation,
    address.floor !== "Unbekannt" ? address.floor : "",
    address.hasElevator ? "aufzug" : "",
    address.hasNoParkingZone ? "halteverbot" : "",
  ].filter(Boolean).length;
}

function getLocationSummary(address: LocationSnapshot) {
  const streetLine = [address.street, address.houseNumber].filter(Boolean).join(" ");
  const locationLine = [address.postalCode, address.city].filter(Boolean).join(" ");

  if (streetLine && locationLine) {
    return `${streetLine}, ${locationLine}`;
  }

  return streetLine || locationLine || "Noch keine Adresse erfasst";
}

function getAddressSummary(address: AddressSectionData) {
  return getLocationSummary(address);
}

function getRoutePointLabel(address: LocationSnapshot) {
  const locationLine = [address.postalCode, address.city].filter(Boolean).join(" ");
  const streetLine = [address.street, address.houseNumber].filter(Boolean).join(" ");

  return locationLine || streetLine || "Offen";
}

function parseWalkingDistanceMeters(value: string) {
  const normalizedValue = value.trim().replace(",", ".");

  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function parseNonNegativeNumber(value: string) {
  const normalizedValue = value.trim().replace(",", ".");
  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function parseNonNegativeInt(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

function formatDistanceLabel(meters: number) {
  if (meters >= 1000) {
    return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
  }

  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(meters)} m`;
}

function formatKilometersLabel(kilometers: number) {
  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: kilometers % 1 === 0 ? 0 : 2,
  }).format(kilometers)} km`;
}

function formatDurationLabel(durationMinutes: number | null) {
  if (durationMinutes === null) {
    return "Dauer folgt über den Routingdienst";
  }

  if (durationMinutes < 60) {
    return `${durationMinutes} Min.`;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  return minutes === 0 ? `${hours} Std.` : `${hours} Std. ${minutes} Min.`;
}

function getAddressKindLabel(kind: MoveCalculationAddressKind) {
  if (kind === "move-out") {
    return "Auszug";
  }

  if (kind === "move-in") {
    return "Einzug";
  }

  return "Zwischenstopp";
}

function buildMoveCalculationAddress(address: AddressSectionData, kind: MoveCalculationAddressKind): MoveCalculationAddressInput {
  return {
    city: address.city,
    floor: address.floor,
    hasElevator: address.hasElevator,
    hasNoParkingZone: address.hasNoParkingZone,
    houseNumber: address.houseNumber,
    id: address.id,
    kind,
    postalCode: address.postalCode,
    street: address.street,
    walkingDistanceMeters: address.walkingDistanceMeters,
  };
}

function buildMoveCalculationFurniture(furniture: FurnitureSelectionData): MoveCalculationFurnitureInput {
  return {
    furnitureName: furniture.furnitureName,
    heightCm: furniture.heightCm,
    id: furniture.id,
    isAssembly: furniture.isAssembly,
    isDisassembly: furniture.isDisassembly,
    isDisposal: furniture.isDisposal,
    lengthCm: furniture.lengthCm,
    widthCm: furniture.widthCm,
  };
}

function getAddressSectionMeta(kind: AddressSectionKind) {
  if (kind === "move-out") {
    return { icon: ArrowRightLeft, eyebrow: "Startpunkt" };
  }

  if (kind === "move-in") {
    return { icon: Building2, eyebrow: "Zielpunkt" };
  }

  return { icon: Route, eyebrow: "Zwischenstopp" };
}

function createAddressSection(id: string, prefill?: Partial<AddressSectionData>): AddressSectionData {
  return {
    id,
    street: prefill?.street ?? "",
    houseNumber: prefill?.houseNumber ?? "",
    postalCode: prefill?.postalCode ?? "",
    city: prefill?.city ?? "",
    livingAreaCubicMeters: prefill?.livingAreaCubicMeters ?? "",
    hasElevator: prefill?.hasElevator ?? false,
    floor: prefill?.floor ?? "Unbekannt",
    walkingDistanceMeters: prefill?.walkingDistanceMeters ?? "",
    hasNoParkingZone: prefill?.hasNoParkingZone ?? false,
    parkingSituation: prefill?.parkingSituation ?? "",
  };
}

function splitStreetAndHouseNumber(streetLine?: string) {
  if (!streetLine) {
    return { street: "", houseNumber: "" };
  }

  const trimmedLine = streetLine.trim();
  const match = trimmedLine.match(/^(.*\D)\s+(\d[\dA-Za-z\-\/]*)$/);

  if (!match) {
    return { street: trimmedLine, houseNumber: "" };
  }

  return {
    street: match[1].trim(),
    houseNumber: match[2].trim(),
  };
}

function buildInitialWizardData(options?: MoveWizardOpenOptions): MoveWizardData {
  const customerPrefill = options?.customerPrefill;
  const originAddress = splitStreetAndHouseNumber(customerPrefill?.street);

  return {
    customer: {
      company: customerPrefill?.company ?? "",
      salutation: customerPrefill?.company ? "Firma" : "",
      firstName: customerPrefill?.firstName ?? "",
      lastName: customerPrefill?.lastName ?? "",
      email: customerPrefill?.email ?? "",
      street: originAddress.street,
      houseNumber: originAddress.houseNumber,
      postalCode: customerPrefill?.postalCode ?? "",
      city: customerPrefill?.city ?? "",
    },
    extras: {
      handyman: {
        ceilingLampCount: "",
        ceilingHeightOver23m: false,
        curtainRodHoleCount: "",
      },
      packing: {
        movingBox: { quantity: "", pack: false, unpack: false },
        bookBox: { quantity: "", pack: false, unpack: false },
        wardrobeBox: { quantity: "", pack: false, unpack: false },
        stretchFilm: { quantity: "", pack: false, unpack: false },
        bubbleWrap: { quantity: "", pack: false, unpack: false },
      },
    },
    furnitureSelections: [],
    kitchen: {
      kitchenMeters: "",
      countertopCount: "",
      applianceCount: "",
      optionDisassembly: false,
      optionAssembly: false,
      optionRebuild: false,
      optionApplianceConnect: false,
      optionCountertopCutting: false,
    },
    plannedDate: "",
    moveOutAddress: createAddressSection("move-out", {
      street: originAddress.street,
      houseNumber: originAddress.houseNumber,
      postalCode: customerPrefill?.postalCode ?? "",
      city: customerPrefill?.city ?? "",
    }),
    stopAddresses: [],
    moveInAddress: createAddressSection("move-in"),
    roomSelections: [],
  };
}

function mergeWizardData(base: MoveWizardData, incoming: unknown): MoveWizardData {
  if (typeof incoming !== "object" || incoming === null) {
    return base;
  }

  const record = incoming as Record<string, unknown>;
  const merged: MoveWizardData = { ...base };

  if (typeof record.plannedDate === "string") merged.plannedDate = record.plannedDate;
  if (Array.isArray(record.roomSelections)) merged.roomSelections = record.roomSelections.filter((item) => typeof item === "string") as string[];
  if (Array.isArray(record.stopAddresses)) merged.stopAddresses = record.stopAddresses as AddressSectionData[];
  if (Array.isArray(record.furnitureSelections)) merged.furnitureSelections = record.furnitureSelections as FurnitureSelectionData[];

  if (typeof record.customer === "object" && record.customer !== null) {
    merged.customer = { ...merged.customer, ...(record.customer as Partial<CustomerStepData>) };
  }

  if (typeof record.moveOutAddress === "object" && record.moveOutAddress !== null) {
    merged.moveOutAddress = { ...merged.moveOutAddress, ...(record.moveOutAddress as Partial<AddressSectionData>) };
  }

  if (typeof record.moveInAddress === "object" && record.moveInAddress !== null) {
    merged.moveInAddress = { ...merged.moveInAddress, ...(record.moveInAddress as Partial<AddressSectionData>) };
  }

  if (typeof record.extras === "object" && record.extras !== null) {
    merged.extras = { ...merged.extras, ...(record.extras as Partial<MoveWizardData["extras"]>) };
  }

  if (typeof record.kitchen === "object" && record.kitchen !== null) {
    merged.kitchen = { ...merged.kitchen, ...(record.kitchen as Partial<MoveWizardData["kitchen"]>) };
  }

  return merged;
}

function parseAddressLine(value: string | null | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const streetLine = parts[0] ?? "";
  const cityLine = parts[1] ?? "";
  const streetParts = splitStreetAndHouseNumber(streetLine);

  let postalCode = "";
  let city = "";
  const cityMatch = cityLine.match(/^(\d{4,6})\s+(.*)$/);
  if (cityMatch) {
    postalCode = cityMatch[1]?.trim() ?? "";
    city = cityMatch[2]?.trim() ?? "";
  } else {
    city = cityLine;
  }

  return {
    street: streetParts.street,
    houseNumber: streetParts.houseNumber,
    postalCode,
    city,
  };
}

function buildMoveCreatePayload(options: MoveWizardOpenOptions | undefined, wizardData: MoveWizardData) {
  const customerAddress = [wizardData.customer.street.trim(), wizardData.customer.houseNumber.trim()].filter(Boolean).join(" ");

  return {
    customerId: options?.customerId,
    customer: options?.customerId
      ? undefined
      : {
          company: wizardData.customer.company.trim(),
          firstName: wizardData.customer.firstName.trim(),
          lastName: wizardData.customer.lastName.trim(),
          address: customerAddress,
          postalCode: wizardData.customer.postalCode.trim(),
          city: wizardData.customer.city.trim(),
          phone: "",
          email: wizardData.customer.email.trim(),
        },
    moveOutAddress: {
      street: wizardData.moveOutAddress.street.trim(),
      houseNumber: wizardData.moveOutAddress.houseNumber.trim(),
      postalCode: wizardData.moveOutAddress.postalCode.trim(),
      city: wizardData.moveOutAddress.city.trim(),
    },
    moveInAddress: {
      street: wizardData.moveInAddress.street.trim(),
      houseNumber: wizardData.moveInAddress.houseNumber.trim(),
      postalCode: wizardData.moveInAddress.postalCode.trim(),
      city: wizardData.moveInAddress.city.trim(),
    },
    plannedDate: wizardData.plannedDate.trim() || undefined,
    wizardData: {
      extras: wizardData.extras,
      kitchen: wizardData.kitchen,
      plannedDate: wizardData.plannedDate.trim() || null,
      roomSelections: wizardData.roomSelections,
      furnitureSelections: wizardData.furnitureSelections,
      stopAddresses: wizardData.stopAddresses,
    },
  };
}

function FieldLabel({
  children,
  gapClass = "gap-2",
  label,
  htmlFor,
  lightMode,
}: {
  children: ReactNode;
  gapClass?: string;
  label: string;
  htmlFor?: string;
  lightMode: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className={`grid text-sm ${gapClass}`}>
      <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>{label}</span>
      {children}
    </label>
  );
}

function CheckboxField({
  checked,
  label,
  lightMode,
  onChange,
}: {
  checked: boolean;
  label: string;
  lightMode: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
        lightMode ? "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200" : "bg-zinc-900 text-zinc-100 ring-1 ring-white/10"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#FF007F]" />
      <span>{label}</span>
    </label>
  );
}

function TogglePriceRow({
  checked,
  chrome,
  hint,
  label,
  lightMode,
  onChange,
  priceLabel,
}: {
  checked: boolean;
  chrome: ReturnType<typeof getPageChrome>;
  hint?: string;
  label: string;
  lightMode: boolean;
  onChange: (checked: boolean) => void;
  priceLabel?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer flex-wrap items-start justify-between gap-3 rounded-xl px-3 py-3 text-sm transition ${
        lightMode ? "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200" : "bg-zinc-900 text-zinc-100 ring-1 ring-white/10"
      }`}
    >
      <span className="flex min-w-[220px] flex-1 items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[#FF007F]"
        />
        <span className="grid gap-1">
          <span className="font-medium leading-5">{label}</span>
          {hint ? <span className={`text-xs ${chrome.mutedText}`}>{hint}</span> : null}
        </span>
      </span>
      {priceLabel ? <span className={`${chrome.neutralChip} shrink-0`}>{priceLabel}</span> : null}
    </label>
  );
}

function AddressSectionCard({
  address,
  chrome,
  customerAddressButtonLabel,
  customerAddressSummary,
  index,
  kind,
  lightMode,
  onApplyCustomerAddress,
  onRemove,
  onToggleBooleanField,
  onUpdateField,
  title,
}: {
  address: AddressSectionData;
  chrome: ReturnType<typeof getPageChrome>;
  customerAddressButtonLabel?: string;
  customerAddressSummary?: string;
  index?: number;
  kind: AddressSectionKind;
  lightMode: boolean;
  onApplyCustomerAddress?: () => void;
  onRemove?: () => void;
  onToggleBooleanField: (field: BooleanAddressField, value: boolean) => void;
  onUpdateField: (field: AddressField, value: string) => void;
  title: string;
}) {
  const fieldPrefix = index !== undefined ? `${address.id}-${index}` : address.id;
  const detailsCount = countFilledAddressDetails(address);
  const addressSummary = getAddressSummary(address);
  const sectionMeta = getAddressSectionMeta(kind);
  const SectionIcon = sectionMeta.icon;
  const customerAddressAvailable = Boolean(customerAddressSummary && customerAddressSummary !== "Noch keine Adresse erfasst");
  const parkingSummary = address.parkingSituation.trim() ? "Parksituation beschrieben" : "Keine Parknotiz";
  const sectionIconClass = `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
    lightMode ? "bg-white text-[#FF007F] ring-1 ring-zinc-200" : "bg-zinc-950 text-[#ff8cc5] ring-1 ring-white/10"
  }`;
  const copyAddressButtonClass = `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
    lightMode
      ? "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:bg-white disabled:text-zinc-400"
      : "bg-zinc-950 text-zinc-100 ring-1 ring-white/10 hover:bg-zinc-900 disabled:bg-zinc-950 disabled:text-zinc-500"
  }`;

  return (
    <article className={chrome.panel}>
      <div
        className={`rounded-2xl p-4 ${
          lightMode ? "bg-[#FF007F]/6 ring-1 ring-[#FF007F]/10" : "bg-[#FF007F]/10 ring-1 ring-[#FF007F]/15"
        }`}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                lightMode ? "bg-white text-[#FF007F] ring-1 ring-zinc-200" : "bg-zinc-950 text-[#ff8cc5] ring-1 ring-white/10"
              }`}
            >
              <SectionIcon className="h-6 w-6" strokeWidth={1.9} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#FF007F]">{sectionMeta.eyebrow}</p>
                <span className={chrome.neutralChip}>{detailsCount} Angaben</span>
              </div>
              <h3 className={`mt-2 text-lg font-semibold ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>{title}</h3>
              <p className={`mt-1 text-sm ${chrome.mutedText}`}>{addressSummary}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 xl:items-end">
            {onApplyCustomerAddress ? (
              <div className={`${chrome.compactSurfaceMuted} max-w-sm`}>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#FF007F]">Kundenadresse</p>
                <p className={`mt-1 text-sm ${lightMode ? "text-zinc-800" : "text-zinc-100"}`}>
                  {customerAddressAvailable ? customerAddressSummary : "Noch nicht in den Kundendaten erfasst"}
                </p>
	            <button
	              type="button"
                  onClick={onApplyCustomerAddress}
                  disabled={!customerAddressAvailable}
                  className={`${copyAddressButtonClass} mt-3`}
                >
                  <MapPin className="h-4 w-4" />
                  {customerAddressButtonLabel}
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                {address.floor !== "Unbekannt" ? address.floor : "Stockwerk offen"}
              </div>
              <div className={`${chrome.compactSurfaceMuted} text-sm`}>{parkingSummary}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className={`${chrome.subtleInset} grid gap-4`}>
          <div className="flex items-start gap-3">
            <div className={sectionIconClass}>
              <MapPin className="h-5 w-5" strokeWidth={1.9} />
            </div>
            <div>
              <h4 className={`text-sm font-semibold ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>Adresse</h4>
              <p className={`mt-1 text-sm ${chrome.mutedText}`}>Straße und Ort für diesen Abschnitt.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(120px,0.8fr)]">
            <FieldLabel htmlFor={`${fieldPrefix}-street`} gapClass="gap-1" label="Straße" lightMode={lightMode}>
              <input
                id={`${fieldPrefix}-street`}
                value={address.street}
                onChange={(event) => onUpdateField("street", event.target.value)}
                className={chrome.input}
                placeholder="Straße"
              />
            </FieldLabel>
            <FieldLabel htmlFor={`${fieldPrefix}-house-number`} gapClass="gap-1" label="Hausnummer" lightMode={lightMode}>
              <input
                id={`${fieldPrefix}-house-number`}
                value={address.houseNumber}
                onChange={(event) => onUpdateField("houseNumber", event.target.value)}
                className={chrome.input}
                placeholder="Nr."
              />
            </FieldLabel>
          </div>

          <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
            <FieldLabel htmlFor={`${fieldPrefix}-postal-code`} gapClass="gap-1" label="PLZ" lightMode={lightMode}>
              <input
                id={`${fieldPrefix}-postal-code`}
                value={address.postalCode}
                onChange={(event) => onUpdateField("postalCode", event.target.value)}
                className={chrome.input}
                placeholder="PLZ"
              />
            </FieldLabel>
            <FieldLabel htmlFor={`${fieldPrefix}-city`} gapClass="gap-1" label="Ort" lightMode={lightMode}>
              <input
                id={`${fieldPrefix}-city`}
                value={address.city}
                onChange={(event) => onUpdateField("city", event.target.value)}
                className={chrome.input}
                placeholder="Ort"
              />
            </FieldLabel>
          </div>
        </section>

        <section className={`${chrome.subtleInset} grid gap-4`}>
          <div className="flex items-start gap-3">
            <div className={sectionIconClass}>
              <Building2 className="h-5 w-5" strokeWidth={1.9} />
            </div>
            <div>
              <h4 className={`text-sm font-semibold ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>Objekt und Zugang</h4>
              <p className={`mt-1 text-sm ${chrome.mutedText}`}>Größe, Stockwerk und Zugangsinfos auf einen Blick.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-3">
            <FieldLabel htmlFor={`${fieldPrefix}-volume`} gapClass="gap-1" label="Wohnfläche in m3" lightMode={lightMode}>
              <input
                id={`${fieldPrefix}-volume`}
                value={address.livingAreaCubicMeters}
                onChange={(event) => onUpdateField("livingAreaCubicMeters", event.target.value)}
                className={chrome.input}
                placeholder="z. B. 120"
              />
            </FieldLabel>
            <FieldLabel htmlFor={`${fieldPrefix}-floor`} gapClass="gap-1" label="Stockwerk" lightMode={lightMode}>
              <select
                id={`${fieldPrefix}-floor`}
                value={address.floor}
                onChange={(event) => onUpdateField("floor", event.target.value)}
                className={chrome.input}
              >
                {floorOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel htmlFor={`${fieldPrefix}-walking-distance`} gapClass="gap-1" label="Fußweg in m" lightMode={lightMode}>
              <input
                id={`${fieldPrefix}-walking-distance`}
                value={address.walkingDistanceMeters}
                onChange={(event) => onUpdateField("walkingDistanceMeters", event.target.value)}
                className={chrome.input}
                inputMode="decimal"
                placeholder="z. B. 25"
              />
            </FieldLabel>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <CheckboxField
              checked={address.hasElevator}
              label="Aufzug vorhanden"
              lightMode={lightMode}
              onChange={(checked) => onToggleBooleanField("hasElevator", checked)}
            />
            <CheckboxField
              checked={address.hasNoParkingZone}
              label="Halteverbotszone"
              lightMode={lightMode}
              onChange={(checked) => onToggleBooleanField("hasNoParkingZone", checked)}
            />
          </div>
        </section>
      </div>

      <section className={`mt-4 ${chrome.subtleInset}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className={sectionIconClass}>
              <CircleParking className="h-5 w-5" strokeWidth={1.9} />
            </div>
            <div>
              <h4 className={`text-sm font-semibold ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>Parksituation</h4>
              <p className={`mt-1 text-sm ${chrome.mutedText}`}>Kurz notieren, was das Team vor Ort wissen sollte.</p>
            </div>
          </div>

          {onRemove ? (
            <button type="button" onClick={onRemove} className={`${chrome.secondaryButton} inline-flex items-center gap-2`}>
              <Trash2 className="h-4 w-4" />
              Entfernen
            </button>
          ) : null}
        </div>

        <div className="mt-4">
          <FieldLabel
            htmlFor={`${fieldPrefix}-parking`}
            gapClass="gap-1"
            label="Hinweise zur Parksituation"
            lightMode={lightMode}
          >
            <textarea
              id={`${fieldPrefix}-parking`}
              value={address.parkingSituation}
              onChange={(event) => onUpdateField("parkingSituation", event.target.value)}
              className={`${chrome.input} min-h-28 resize-y`}
              placeholder="Kurz beschreiben, wie die Parksituation vor Ort aussieht."
            />
          </FieldLabel>
        </div>
      </section>
    </article>
  );
}

function FurnitureSelectionCard({
  chrome,
  furniture,
  lightMode,
  onRemove,
  onToggleBooleanField,
  onUpdateDimensionField,
}: {
  chrome: ReturnType<typeof getPageChrome>;
  furniture: FurnitureSelectionData;
  lightMode: boolean;
  onRemove: () => void;
  onToggleBooleanField: (field: FurnitureBooleanField, value: boolean) => void;
  onUpdateDimensionField: (field: FurnitureDimensionField, value: string) => void;
}) {
  return (
    <article className={chrome.subtlePanel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className={`text-base font-semibold ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>{furniture.furnitureName}</h4>
            <span className={chrome.neutralChip}>{furniture.room}</span>
            <span className={chrome.chip}>{getFurnitureCategoryLabel(furniture.category)}</span>
          </div>
          <p className={`mt-1 text-sm ${chrome.mutedText}`}>Maße anpassen und Leistungen für dieses Möbelstück markieren.</p>
        </div>

        <button type="button" onClick={onRemove} className={`${chrome.secondaryButton} inline-flex items-center gap-2`}>
          <Trash2 className="h-4 w-4" />
          Entfernen
        </button>
      </div>

      <div className="mt-4 rounded-2xl p-4 ring-1 ring-inset ring-[#FF007F]/10">
        <p className="text-xs uppercase tracking-[0.18em] text-[#FF007F]">Maße in cm</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <FieldLabel label="Länge" lightMode={lightMode}>
            <input
              value={furniture.lengthCm}
              onChange={(event) => onUpdateDimensionField("lengthCm", event.target.value)}
              className={chrome.input}
              inputMode="decimal"
              placeholder="Länge"
            />
          </FieldLabel>
          <FieldLabel label="Breite" lightMode={lightMode}>
            <input
              value={furniture.widthCm}
              onChange={(event) => onUpdateDimensionField("widthCm", event.target.value)}
              className={chrome.input}
              inputMode="decimal"
              placeholder="Breite"
            />
          </FieldLabel>
          <FieldLabel label="Höhe" lightMode={lightMode}>
            <input
              value={furniture.heightCm}
              onChange={(event) => onUpdateDimensionField("heightCm", event.target.value)}
              className={chrome.input}
              inputMode="decimal"
              placeholder="Höhe"
            />
          </FieldLabel>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.18em] text-[#FF007F]">Leistungen</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <CheckboxField
            checked={furniture.isDisposal}
            label="Entrümpeln"
            lightMode={lightMode}
            onChange={(checked) => onToggleBooleanField("isDisposal", checked)}
          />
          <CheckboxField
            checked={furniture.isAssembly}
            label="Aufbau"
            lightMode={lightMode}
            onChange={(checked) => onToggleBooleanField("isAssembly", checked)}
          />
          <CheckboxField
            checked={furniture.isDisassembly}
            label="Abbau"
            lightMode={lightMode}
            onChange={(checked) => onToggleBooleanField("isDisassembly", checked)}
          />
        </div>
      </div>
    </article>
  );
}

function RoomSelectionButton({
  icon: Icon,
  isSelected,
  label,
  lightMode,
  onToggle,
}: {
  icon: LucideIcon;
  isSelected: boolean;
  label: string;
  lightMode: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block">
      <input type="checkbox" checked={isSelected} onChange={onToggle} className="peer sr-only" />
      <span
        className={`flex min-h-[11.5rem] cursor-pointer flex-col items-center justify-between rounded-2xl border-2 p-5 text-center transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF007F]/35 ${
          lightMode ? "peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-100" : "peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950"
        } ${
          isSelected
            ? lightMode
              ? "border-[#FF007F] bg-[#FF007F]/8 text-zinc-900 shadow-lg shadow-[#FF007F]/10"
              : "border-[#FF007F] bg-[#FF007F]/12 text-zinc-100 shadow-lg shadow-[#FF007F]/15"
            : lightMode
              ? "border-zinc-200 bg-white text-zinc-900 hover:border-[#FF007F]/35 hover:bg-zinc-50"
              : "border-white/10 bg-zinc-950 text-zinc-100 hover:border-[#FF007F]/30 hover:bg-zinc-900"
        }`}
      >
        <div
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border ${
            isSelected
              ? lightMode
                ? "border-[#FF007F]/20 bg-[#FF007F] text-white"
                : "border-[#FF007F]/25 bg-[#FF007F]/20 text-[#ff8cc5]"
              : lightMode
                ? "border-zinc-200 bg-zinc-50 text-[#FF007F]"
                : "border-white/10 bg-zinc-900 text-zinc-200"
          }`}
        >
          <Icon className="h-10 w-10" strokeWidth={1.8} />
        </div>
        <div className="mt-4">
          <p className="text-base font-semibold">{label}</p>
          <p className={`mt-2 text-xs uppercase tracking-[0.16em] ${isSelected ? "text-[#FF007F]" : lightMode ? "text-zinc-500" : "text-zinc-400"}`}>
            {isSelected ? "Aktiv" : "Inaktiv"}
          </p>
        </div>
      </span>
    </label>
  );
}

function MoveWizardModal({
  lightMode,
  onClose,
  options,
}: {
  lightMode: boolean;
  onClose: () => void;
  options?: MoveWizardOpenOptions;
}) {
  const chrome = getPageChrome(lightMode);
  const moveId = options?.moveId?.trim() || "";
  const isEditMode = Boolean(moveId);
  const [currentStepId, setCurrentStepId] = useState(baseWizardSteps[0]?.id ?? "customer");
  const [stepMenuOpen, setStepMenuOpen] = useState(false);
  const [wizardData, setWizardData] = useState(() => buildInitialWizardData(options));
  const [editingMoveMeta, setEditingMoveMeta] = useState<{
    customerId: string;
    customerName: string;
    customerNumber: string;
    id: string;
    moveNumber: string;
  } | null>(null);
  const [isLoadingEditMove, setIsLoadingEditMove] = useState(false);
  const [furniturePickerOpen, setFurniturePickerOpen] = useState(false);
  const [furnitureSearch, setFurnitureSearch] = useState("");
  const [selectedFurnitureCategory, setSelectedFurnitureCategory] = useState<"all" | FurnitureCategoryId>("all");
  const [selectedFurnitureOptionKey, setSelectedFurnitureOptionKey] = useState<string | null>(null);
  const [pricingConfig, setPricingConfig] = useState<MovePricingConfig>(defaultMovePricingConfig);
  const [isSavingMove, setIsSavingMove] = useState(false);
  const [isGeneratingDocuments, setIsGeneratingDocuments] = useState(false);
  const [generatedDocuments, setGeneratedDocuments] = useState<
    Array<{ fileName: string; fileUrl: string; label: string; relativePath: string }>
  >([]);
  const [moveCalculation, setMoveCalculation] = useState<MoveCalculationUiState>({
    data: null,
    message: "Start- und Zieladresse ergänzen, dann berechnen wir Route und Preis live.",
    status: "idle",
    warnings: [],
  });
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [calculationRetryToken, setCalculationRetryToken] = useState(0);
  const calculationRetryAttemptRef = useRef(0);
  const lastCalculationRequestKeyRef = useRef<string>("");

  useEffect(() => {
    if (!isEditMode || !moveId) {
      setEditingMoveMeta(null);
      return;
    }

    let cancelled = false;
    async function loadMoveForEdit() {
      setIsLoadingEditMove(true);
      setSaveErrorMessage("");
      try {
        const response = await fetch(`/api/moves/${encodeURIComponent(moveId)}`, { method: "GET" });
        const payload = ((await readJsonResponse<MoveDetailsApiResponse>(response)) ?? {}) as MoveDetailsApiResponse;
        if (!response.ok || !payload.move) {
          throw new Error(payload.message ?? "Umzug konnte nicht geladen werden.");
        }

        if (cancelled) return;

        setEditingMoveMeta({
          id: payload.move.id,
          moveNumber: payload.move.moveNumber,
          customerId: payload.move.customer.id,
          customerNumber: payload.move.customer.customerNumber,
          customerName: payload.move.customer.name,
        });

        const base = buildInitialWizardData({
          ...options,
          customerId: payload.move.customer.id,
          customerPrefill: {
            company: payload.move.customer.company ?? "",
            firstName: payload.move.customer.firstName,
            lastName: payload.move.customer.lastName,
            email: payload.move.customer.email,
            customerNumber: payload.move.customer.customerNumber,
            postalCode: payload.move.customer.postalCode,
            city: payload.move.customer.city,
            street: payload.move.customer.address,
          },
        });
        const merged = mergeWizardData(base, payload.move.wizardData);

        const incoming = payload.move.wizardData;
        const hasIncomingCustomer = typeof incoming === "object" && incoming !== null && "customer" in (incoming as Record<string, unknown>);
        const hasIncomingMoveOut = typeof incoming === "object" && incoming !== null && "moveOutAddress" in (incoming as Record<string, unknown>);
        const hasIncomingMoveIn = typeof incoming === "object" && incoming !== null && "moveInAddress" in (incoming as Record<string, unknown>);

        if (!hasIncomingCustomer) {
          const customerStreetSplit = splitStreetAndHouseNumber(payload.move.customer.address);
          merged.customer = {
            ...merged.customer,
            company: payload.move.customer.company ?? "",
            salutation: payload.move.customer.company ? "Firma" : merged.customer.salutation,
            firstName: payload.move.customer.firstName,
            lastName: payload.move.customer.lastName,
            email: payload.move.customer.email,
            street: customerStreetSplit.street,
            houseNumber: customerStreetSplit.houseNumber,
            postalCode: payload.move.customer.postalCode,
            city: payload.move.customer.city,
          };
        }

        if (!hasIncomingMoveOut) {
          const parsed = parseAddressLine(payload.move.originAddress) ?? parseAddressLine(payload.move.customer.address);
          if (parsed) {
            merged.moveOutAddress = createAddressSection("move-out", parsed);
          }
        }

        if (!hasIncomingMoveIn) {
          const parsed = parseAddressLine(payload.move.destinationAddress);
          if (parsed) {
            merged.moveInAddress = createAddressSection("move-in", parsed);
          }
        }

        if (!merged.plannedDate && payload.move.plannedStartDate) {
          merged.plannedDate = payload.move.plannedStartDate.slice(0, 10);
        }

        setWizardData(merged);
      } catch (error) {
        if (cancelled) return;
        setSaveErrorMessage(error instanceof Error ? error.message : "Umzug konnte nicht geladen werden.");
      } finally {
        if (!cancelled) setIsLoadingEditMove(false);
      }
    }

    void loadMoveForEdit();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, moveId, options]);
  const wizardSteps = useMemo(() => {
    const hasKitchenRoom = wizardData.roomSelections.includes("kitchen");
    return baseWizardSteps.filter((step) => hasKitchenRoom || step.id !== "kitchen");
  }, [wizardData.roomSelections]);
  const visibleWizardSteps = useMemo(() => wizardSteps.filter((step) => !step.hidden), [wizardSteps]);
  const currentStepIndex = useMemo(() => wizardSteps.findIndex((step) => step.id === currentStepId), [currentStepId, wizardSteps]);
  const currentStep = wizardSteps[Math.max(currentStepIndex, 0)] ?? wizardSteps[0];
  const visibleStepIndex = useMemo(
    () => Math.max(0, visibleWizardSteps.findIndex((step) => step.id === currentStep.id)),
    [currentStep.id, visibleWizardSteps],
  );
  const routeAddresses = [wizardData.moveOutAddress, ...wizardData.stopAddresses, wizardData.moveInAddress];
  const addressSectionCount = wizardData.stopAddresses.length + 2;
  const customerAddressSummary = getLocationSummary(wizardData.customer);
  const routeStartLabel = getRoutePointLabel(wizardData.moveOutAddress);
  const routeEndLabel = getRoutePointLabel(wizardData.moveInAddress);
  const selectedRoomLabels = getRoomLabelsFromSelectionIds(wizardData.roomSelections);
  const selectedRoomCount = wizardData.roomSelections.length;
  const handymanCeilingLampCount = parseNonNegativeInt(wizardData.extras.handyman.ceilingLampCount);
  const handymanCurtainRodHoleCount = parseNonNegativeInt(wizardData.extras.handyman.curtainRodHoleCount);
  const kitchenMeters = parseNonNegativeNumber(wizardData.kitchen.kitchenMeters);
  const kitchenCountertopCount = parseNonNegativeInt(wizardData.kitchen.countertopCount);
  const kitchenApplianceCount = parseNonNegativeInt(wizardData.kitchen.applianceCount);
  const totalWalkingDistance = routeAddresses.reduce(
    (sum, address) => sum + parseWalkingDistanceMeters(address.walkingDistanceMeters),
    0,
  );
  const totalWalkingDistanceLabel = totalWalkingDistance > 0 ? formatDistanceLabel(totalWalkingDistance) : "Noch offen";
  const normalizedFurnitureSearch = furnitureSearch.trim().toLowerCase();
  const availableFurnitureOptions = selectedRoomLabels.flatMap((roomLabel) =>
    furnitureCatalog
      .filter((catalogItem) => catalogItem.rooms.includes(roomLabel))
      .map((catalogItem) => ({
        key: createFurnitureOptionKey(catalogItem.id, roomLabel),
        catalogItem,
        roomLabel,
      })),
  );
  const filteredFurnitureGroups = selectedRoomLabels.map((roomLabel) => ({
    roomLabel,
    options: furnitureCatalog
      .filter(
        (catalogItem) =>
          catalogItem.rooms.includes(roomLabel) &&
          (selectedFurnitureCategory === "all" || catalogItem.category === selectedFurnitureCategory) &&
          (normalizedFurnitureSearch.length === 0 ||
            [catalogItem.furnitureName, getFurnitureCategoryLabel(catalogItem.category)]
              .join(" ")
              .toLowerCase()
              .includes(normalizedFurnitureSearch)),
      )
      .sort((left, right) => left.furnitureName.localeCompare(right.furnitureName, "de")),
  }));
  const selectedFurnitureOption =
    selectedFurnitureOptionKey
      ? availableFurnitureOptions.find((option) => option.key === selectedFurnitureOptionKey) ?? null
      : null;
  const existingFurnitureComboKeys = new Set(
    wizardData.furnitureSelections.map((furniture) => createFurnitureOptionKey(furniture.catalogItemId, furniture.room)),
  );
  const missingStandardFurnitureOptions = selectedRoomLabels.flatMap((roomLabel) =>
    furnitureCatalog
      .filter((catalogItem) => catalogItem.standardRooms.includes(roomLabel))
      .map((catalogItem) => ({
        key: createFurnitureOptionKey(catalogItem.id, roomLabel),
        catalogItem,
        roomLabel,
      }))
      .filter((option) => !existingFurnitureComboKeys.has(option.key)),
  );
  const furnitureSelectionsByRoom = selectedRoomLabels
    .map((roomLabel) => ({
      roomLabel,
      items: wizardData.furnitureSelections.filter((furniture) => furniture.room === roomLabel),
    }))
    .filter((group) => group.items.length > 0);
  const sourceLabel = options?.sourceLabel ?? "Allgemein";
  const customerNumber = editingMoveMeta?.customerNumber ?? options?.customerPrefill?.customerNumber;
  const stepProgressPercent =
    visibleWizardSteps.length > 1 ? Math.round((visibleStepIndex / (visibleWizardSteps.length - 1)) * 100) : 0;
  const routeCalculationRequest = useMemo<MoveCalculationRequest>(
    () => ({
      furnitureSelections: wizardData.furnitureSelections.map((furnitureSelection) => buildMoveCalculationFurniture(furnitureSelection)),
      moveInAddress: buildMoveCalculationAddress(wizardData.moveInAddress, "move-in"),
      moveOutAddress: buildMoveCalculationAddress(wizardData.moveOutAddress, "move-out"),
      stopAddresses: wizardData.stopAddresses.map((stopAddress) => buildMoveCalculationAddress(stopAddress, "stop")),
    }),
    [wizardData.furnitureSelections, wizardData.moveInAddress, wizardData.moveOutAddress, wizardData.stopAddresses],
  );
  const routeCalculationReadiness = useMemo(
    () => getMoveCalculationReadiness(routeCalculationRequest),
    [routeCalculationRequest],
  );
  const routeCalculationData = moveCalculation.data;
  const populatedStopAddresses = wizardData.stopAddresses.filter((stopAddress) => hasAnyAddressData(stopAddress));
  const stopOrderChanged =
    routeCalculationData !== null &&
    routeCalculationData.orderedStops.length === populatedStopAddresses.length &&
    routeCalculationData.orderedStops.some((orderedStop, index) => populatedStopAddresses[index]?.id !== orderedStop.id);
  const routeDistanceLabel =
    routeCalculationData !== null
      ? formatKilometersLabel(routeCalculationData.route.distanceKilometers)
      : moveCalculation.status === "loading"
        ? "Berechne..."
        : "Noch offen";
  const routeDurationLabel =
    routeCalculationData !== null
      ? formatDurationLabel(routeCalculationData.route.durationMinutes)
      : moveCalculation.status === "loading"
        ? "Schnellste Strecke wird berechnet"
        : "Sobald Start und Ziel vollständig sind";
  const routeSequenceLabel =
    routeCalculationData !== null
      ? routeCalculationData.orderedRoute.map((routePoint) => routePoint.label).join(" -> ")
      : null;
  const handymanLampPrice =
    handymanCeilingLampCount > 0 ? handymanCeilingLampCount * pricingConfig.ceilingLampInstallPricePerItem : 0;
  const handymanHeightSurcharge =
    wizardData.extras.handyman.ceilingHeightOver23m && handymanCeilingLampCount > 0 ? pricingConfig.ceilingHeightSurcharge : 0;
  const handymanCurtainRodHolesPrice =
    handymanCurtainRodHoleCount > 0 ? handymanCurtainRodHoleCount * pricingConfig.curtainRodHolePricePerItem : 0;
  const handymanTotalPrice = handymanLampPrice + handymanHeightSurcharge + handymanCurtainRodHolesPrice;

  const packingMaterialDefinitions = [
    {
      key: "movingBox",
      label: "Umzugskarton",
      unit: "Stk",
      unitPrice: pricingConfig.movingBoxPrice,
      quantity: parseNonNegativeInt(wizardData.extras.packing.movingBox.quantity),
    },
    {
      key: "bookBox",
      label: "Bücherkarton",
      unit: "Stk",
      unitPrice: pricingConfig.bookBoxPrice,
      quantity: parseNonNegativeInt(wizardData.extras.packing.bookBox.quantity),
    },
    {
      key: "wardrobeBox",
      label: "Kleiderkarton",
      unit: "Stk",
      unitPrice: pricingConfig.wardrobeBoxPrice,
      quantity: parseNonNegativeInt(wizardData.extras.packing.wardrobeBox.quantity),
    },
    {
      key: "stretchFilm",
      label: "Stretchfolie",
      unit: "lfm",
      unitPrice: pricingConfig.stretchFilmPricePerMeter,
      quantity: parseNonNegativeNumber(wizardData.extras.packing.stretchFilm.quantity),
    },
    {
      key: "bubbleWrap",
      label: "Luftpolsterfolie 1x1m",
      unit: "Stk",
      unitPrice: pricingConfig.bubbleWrapSheetPrice,
      quantity: parseNonNegativeInt(wizardData.extras.packing.bubbleWrap.quantity),
    },
  ] as const;

  const packingLineItems = packingMaterialDefinitions
    .filter((definition) => definition.quantity > 0)
    .map((definition) => {
      const selection = wizardData.extras.packing[definition.key satisfies PackingMaterialKey];
      const materialPrice = definition.quantity * definition.unitPrice;
      const packPrice = selection.pack ? definition.quantity * pricingConfig.packingPackPricePerItem : 0;
      const unpackPrice = selection.unpack ? definition.quantity * pricingConfig.packingUnpackPricePerItem : 0;

      return {
        ...definition,
        materialPrice,
        packPrice,
        unpackPrice,
        totalPrice: materialPrice + packPrice + unpackPrice,
      };
    });
  const packingTotalPrice = packingLineItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const kitchenDisassemblyPrice =
    wizardData.kitchen.optionDisassembly && kitchenMeters > 0 ? kitchenMeters * pricingConfig.kitchenDisassemblyPricePerMeter : 0;
  const kitchenAssemblyPrice =
    wizardData.kitchen.optionAssembly && kitchenMeters > 0 ? kitchenMeters * pricingConfig.kitchenAssemblyPricePerMeter : 0;
  const kitchenRebuildPrice =
    wizardData.kitchen.optionRebuild && kitchenMeters > 0 ? kitchenMeters * pricingConfig.kitchenRebuildPricePerMeter : 0;
  const kitchenApplianceConnectPrice =
    wizardData.kitchen.optionApplianceConnect && kitchenApplianceCount > 0
      ? kitchenApplianceCount * pricingConfig.applianceConnectionPricePerItem
      : 0;
  const kitchenCountertopCuttingPrice =
    wizardData.kitchen.optionCountertopCutting && kitchenCountertopCount > 0
      ? kitchenCountertopCount * pricingConfig.countertopCuttingPricePerItem
      : 0;
  const kitchenTotalPrice =
    kitchenDisassemblyPrice +
    kitchenAssemblyPrice +
    kitchenRebuildPrice +
    kitchenApplianceConnectPrice +
    kitchenCountertopCuttingPrice;

  const extrasTotalPrice = handymanTotalPrice + packingTotalPrice;
  const manualServicesTotalPrice = extrasTotalPrice + kitchenTotalPrice;
  const routeBasePrice = routeCalculationData?.pricing.totalPrice ?? 0;
  const grandTotalPrice = routeBasePrice + manualServicesTotalPrice;

  const livePriceLabel =
    routeCalculationData !== null
      ? priceFormatter.format(grandTotalPrice)
      : moveCalculation.status === "loading"
        ? "Berechne..."
        : manualServicesTotalPrice > 0
          ? `+ ${priceFormatter.format(manualServicesTotalPrice)} Zusatz`
          : "Adressen ergänzen";
  const additionalAddressCharges =
    routeCalculationData?.pricing.addressCharges.filter(
      (addressCharge) =>
        addressCharge.walkingDistancePrice > 0 || addressCharge.noParkingZonePrice > 0 || addressCharge.accessPrice > 0,
    ) ?? [];
  const additionalFurnitureCharges =
    routeCalculationData?.pricing.furnitureCharges.filter(
      (furnitureCharge) =>
        furnitureCharge.assemblyPrice > 0 || furnitureCharge.disassemblyPrice > 0 || furnitureCharge.disposalPrice > 0,
    ) ?? [];
  const accessAndAddressPrice =
    routeCalculationData !== null
      ? priceFormatter.format(
          routeCalculationData.pricing.walkingDistancePrice +
            routeCalculationData.pricing.accessPrice +
            routeCalculationData.pricing.noParkingZonePrice,
        )
      : "-";
  const furnitureAndServicePrice =
    routeCalculationData !== null
      ? priceFormatter.format(
          routeCalculationData.pricing.furnitureVolumePrice +
            routeCalculationData.pricing.assemblyPrice +
            routeCalculationData.pricing.disassemblyPrice +
            routeCalculationData.pricing.disposalPrice,
        )
      : "-";
  const visibleMoveCalculationWarnings = Array.from(new Set(moveCalculation.warnings)).filter(
    (warning) => warning !== moveCalculation.message,
  );
  const acuteMoveCalculationError = moveCalculation.status === "error" ? moveCalculation.message : null;
	  const routeStatusLabel =
	    routeCalculationData !== null
	      ? routeCalculationData.provider === "osrm"
	        ? "Schnellste Straßenroute live berechnet"
	        : "Fallback aktiv: Strecke aktuell aus Luftlinien-Näherung"
	      : moveCalculation.status === "loading"
	        ? "Schnellste Route und Preis werden gerade berechnet."
	        : moveCalculation.status === "error"
	          ? null
	          : moveCalculation.message;

  useEffect(() => {
    if (currentStepIndex >= 0) {
      return;
    }

    setCurrentStepId(wizardSteps[0]?.id ?? "customer");
  }, [currentStepIndex, wizardSteps]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const response = await fetch("/api/settings/pricing", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await readJsonResponse<{ pricingConfig?: MovePricingConfig }>(response)) ?? {};

        if (isMounted && payload.pricingConfig) {
          setPricingConfig(payload.pricingConfig);
        }
      } catch {
        // Defaultwerte bleiben aktiv, wenn die Preise gerade nicht geladen werden können.
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!routeCalculationReadiness.isReady) {
      calculationRetryAttemptRef.current = 0;
      lastCalculationRequestKeyRef.current = "";
      setMoveCalculation({
        data: null,
        message:
          routeCalculationReadiness.warnings[0] ??
          "Start- und Zieladresse ergänzen, dann berechnen wir Route und Preis live.",
        status: "idle",
        warnings: routeCalculationReadiness.warnings,
      });
      return;
    }

    const abortController = new AbortController();
    const requestKey = JSON.stringify(routeCalculationRequest);
    if (lastCalculationRequestKeyRef.current !== requestKey) {
      lastCalculationRequestKeyRef.current = requestKey;
      calculationRetryAttemptRef.current = 0;
    }

    let retryTimeoutId: number | null = null;
    const timeoutId = window.setTimeout(async () => {
      setMoveCalculation({
        data: null,
        message: "Route und Preis werden gerade berechnet.",
        status: "loading",
        warnings: routeCalculationReadiness.warnings,
      });

      try {
        const response = await fetch("/api/move-calculation", {
          body: JSON.stringify(routeCalculationRequest),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: abortController.signal,
        });
        const payload = await readJsonResponseOrThrow<MoveCalculationErrorResponse | MoveCalculationResponse>(response);

        if (!response.ok || payload.status === "error") {
          throw new Error(payload.message || "Die Route konnte nicht berechnet werden.");
        }

        if (payload.status === "rate_limited") {
          const baseWait = Math.min(60, Math.max(2, payload.retryAfterSeconds || 2));
          const attempt = calculationRetryAttemptRef.current;
          const waitSeconds = Math.min(60, Math.round(baseWait * Math.pow(1.7, attempt)));
          calculationRetryAttemptRef.current = attempt + 1;

          setMoveCalculation({
            data: null,
            message: `${payload.message} Neuer Versuch in ${waitSeconds}s.`,
            status: "idle",
            warnings: payload.warnings,
          });

          retryTimeoutId = window.setTimeout(() => {
            setCalculationRetryToken((value) => value + 1);
          }, waitSeconds * 1000);
          return;
        }

        if (payload.status !== "ready") {
          calculationRetryAttemptRef.current = 0;
          setMoveCalculation({
            data: null,
            message: payload.message,
            status: "idle",
            warnings: payload.warnings,
          });
          return;
        }

        calculationRetryAttemptRef.current = 0;
        setMoveCalculation({
          data: payload,
          message: payload.message,
          status: "ready",
          warnings: payload.warnings,
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setMoveCalculation({
          data: null,
          message: error instanceof Error ? error.message : "Die Route konnte nicht berechnet werden.",
          status: "error",
          warnings: [],
        });
      }
    }, 350);

    return () => {
      abortController.abort();
      window.clearTimeout(timeoutId);
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }
    };
  }, [calculationRetryToken, routeCalculationReadiness, routeCalculationRequest]);

  function updateCustomerField(field: CustomerField, value: string) {
    setWizardData((currentData) => ({
      ...currentData,
      customer: {
        ...currentData.customer,
        [field]: value,
      },
    }));
  }

  function updatePlannedDate(value: string) {
    setWizardData((currentData) => ({
      ...currentData,
      plannedDate: value,
    }));
  }

  function updateRootAddressField(
    addressKey: "moveInAddress" | "moveOutAddress",
    field: AddressField,
    value: string,
  ) {
    setWizardData((currentData) => ({
      ...currentData,
      [addressKey]: {
        ...currentData[addressKey],
        [field]: value,
      },
    }));
  }

  function toggleRootAddressBooleanField(
    addressKey: "moveInAddress" | "moveOutAddress",
    field: BooleanAddressField,
    value: boolean,
  ) {
    setWizardData((currentData) => ({
      ...currentData,
      [addressKey]: {
        ...currentData[addressKey],
        [field]: value,
      },
    }));
  }

  function applyCustomerAddressToRootAddress(addressKey: "moveInAddress" | "moveOutAddress") {
    setWizardData((currentData) => ({
      ...currentData,
      [addressKey]: {
        ...currentData[addressKey],
        street: currentData.customer.street,
        houseNumber: currentData.customer.houseNumber,
        postalCode: currentData.customer.postalCode,
        city: currentData.customer.city,
      },
    }));
  }

  function updateStopAddressField(stopId: string, field: AddressField, value: string) {
    setWizardData((currentData) => ({
      ...currentData,
      stopAddresses: currentData.stopAddresses.map((stopAddress) =>
        stopAddress.id === stopId ? { ...stopAddress, [field]: value } : stopAddress,
      ),
    }));
  }

  function toggleStopAddressBooleanField(stopId: string, field: BooleanAddressField, value: boolean) {
    setWizardData((currentData) => ({
      ...currentData,
      stopAddresses: currentData.stopAddresses.map((stopAddress) =>
        stopAddress.id === stopId ? { ...stopAddress, [field]: value } : stopAddress,
      ),
    }));
  }

  function addStopAddress() {
    setWizardData((currentData) => ({
      ...currentData,
      stopAddresses: [...currentData.stopAddresses, createAddressSection(globalThis.crypto?.randomUUID?.() ?? `stop-${Date.now()}`)],
    }));
  }

  function removeStopAddress(stopId: string) {
    setWizardData((currentData) => ({
      ...currentData,
      stopAddresses: currentData.stopAddresses.filter((stopAddress) => stopAddress.id !== stopId),
    }));
  }

  function applyCalculatedStopOrder() {
    if (!routeCalculationData) {
      return;
    }

    setWizardData((currentData) => {
      const stopAddressMap = new Map(currentData.stopAddresses.map((stopAddress) => [stopAddress.id, stopAddress] as const));
      const orderedStopIds = new Set(routeCalculationData.orderedStops.map((orderedStop) => orderedStop.id));
      const orderedStopAddresses = routeCalculationData.orderedStops
        .map((orderedStop) => stopAddressMap.get(orderedStop.id))
        .filter((stopAddress): stopAddress is AddressSectionData => Boolean(stopAddress));
      const remainingStopAddresses = currentData.stopAddresses.filter((stopAddress) => !orderedStopIds.has(stopAddress.id));

      return {
        ...currentData,
        stopAddresses: [...orderedStopAddresses, ...remainingStopAddresses],
      };
    });
  }

  function toggleRoomSelection(roomId: string) {
    const roomLabel = roomOptions.find((room) => room.id === roomId)?.label;

    setWizardData((currentData) => ({
      ...currentData,
      roomSelections: currentData.roomSelections.includes(roomId)
        ? currentData.roomSelections.filter((currentRoomId) => currentRoomId !== roomId)
        : [...currentData.roomSelections, roomId],
      furnitureSelections:
        currentData.roomSelections.includes(roomId) && roomLabel
          ? currentData.furnitureSelections.filter((furniture) => furniture.room !== roomLabel)
          : currentData.furnitureSelections,
    }));
  }

  function addFurnitureSelection(option: { catalogItem: FurnitureCatalogItem; roomLabel: string }) {
    setWizardData((currentData) => ({
      ...currentData,
      furnitureSelections: [...currentData.furnitureSelections, createFurnitureSelection(option.catalogItem, option.roomLabel)],
    }));
  }

  function addSelectedFurnitureOption() {
    if (!selectedFurnitureOption) {
      return;
    }

    addFurnitureSelection(selectedFurnitureOption);
    setFurniturePickerOpen(false);
    setFurnitureSearch("");
    setSelectedFurnitureOptionKey(null);
  }

  function addMissingStandardFurniture() {
    setWizardData((currentData) => {
      const roomLabels = getRoomLabelsFromSelectionIds(currentData.roomSelections);
      const existingKeys = new Set(
        currentData.furnitureSelections.map((furniture) => createFurnitureOptionKey(furniture.catalogItemId, furniture.room)),
      );
      const standardOptionsToAdd = roomLabels.flatMap((roomLabel) =>
        furnitureCatalog
          .filter((catalogItem) => catalogItem.standardRooms.includes(roomLabel))
          .map((catalogItem) => ({
            key: createFurnitureOptionKey(catalogItem.id, roomLabel),
            catalogItem,
            roomLabel,
          }))
          .filter((option) => !existingKeys.has(option.key)),
      );

      if (standardOptionsToAdd.length === 0) {
        return currentData;
      }

      return {
        ...currentData,
        furnitureSelections: [
          ...currentData.furnitureSelections,
          ...standardOptionsToAdd.map((option) => createFurnitureSelection(option.catalogItem, option.roomLabel)),
        ],
      };
    });

    setFurniturePickerOpen(false);
    setFurnitureSearch("");
    setSelectedFurnitureOptionKey(null);
  }

  function updateFurnitureDimensionField(furnitureId: string, field: FurnitureDimensionField, value: string) {
    setWizardData((currentData) => ({
      ...currentData,
      furnitureSelections: currentData.furnitureSelections.map((furniture) =>
        furniture.id === furnitureId ? { ...furniture, [field]: value } : furniture,
      ),
    }));
  }

  function toggleFurnitureBooleanField(furnitureId: string, field: FurnitureBooleanField, value: boolean) {
    setWizardData((currentData) => ({
      ...currentData,
      furnitureSelections: currentData.furnitureSelections.map((furniture) =>
        furniture.id === furnitureId ? { ...furniture, [field]: value } : furniture,
      ),
    }));
  }

  function removeFurnitureSelection(furnitureId: string) {
    setWizardData((currentData) => ({
      ...currentData,
      furnitureSelections: currentData.furnitureSelections.filter((furniture) => furniture.id !== furnitureId),
    }));
  }

  function updateHandymanField(field: keyof ExtrasHandymanData, value: string) {
    setWizardData((currentData) => ({
      ...currentData,
      extras: {
        ...currentData.extras,
        handyman: {
          ...currentData.extras.handyman,
          [field]: value,
        },
      },
    }));
  }

  function toggleHandymanField(field: keyof Pick<ExtrasHandymanData, "ceilingHeightOver23m">, value: boolean) {
    setWizardData((currentData) => ({
      ...currentData,
      extras: {
        ...currentData.extras,
        handyman: {
          ...currentData.extras.handyman,
          [field]: value,
        },
      },
    }));
  }

  function updatePackingQuantity(key: PackingMaterialKey, value: string) {
    setWizardData((currentData) => ({
      ...currentData,
      extras: {
        ...currentData.extras,
        packing: {
          ...currentData.extras.packing,
          [key]: {
            ...currentData.extras.packing[key],
            quantity: value,
          },
        },
      },
    }));
  }

  function togglePackingOption(key: PackingMaterialKey, field: "pack" | "unpack", value: boolean) {
    setWizardData((currentData) => ({
      ...currentData,
      extras: {
        ...currentData.extras,
        packing: {
          ...currentData.extras.packing,
          [key]: {
            ...currentData.extras.packing[key],
            [field]: value,
          },
        },
      },
    }));
  }

  function updateKitchenField(field: "kitchenMeters" | "countertopCount" | "applianceCount", value: string) {
    setWizardData((currentData) => ({
      ...currentData,
      kitchen: {
        ...currentData.kitchen,
        [field]: value,
      },
    }));
  }

  function toggleKitchenOption(
    field:
      | "optionDisassembly"
      | "optionAssembly"
      | "optionRebuild"
      | "optionApplianceConnect"
      | "optionCountertopCutting",
    value: boolean,
  ) {
    setWizardData((currentData) => ({
      ...currentData,
      kitchen: {
        ...currentData.kitchen,
        [field]: value,
      },
    }));
  }

  function goToPreviousStep() {
    const index = currentStepIndex >= 0 ? currentStepIndex : 0;
    const previousStep = wizardSteps[Math.max(index - 1, 0)];
    if (previousStep) {
      setCurrentStepId(previousStep.id);
    }
  }

  function goToNextStep() {
    const index = currentStepIndex >= 0 ? currentStepIndex : 0;
    const nextStep = wizardSteps[Math.min(index + 1, wizardSteps.length - 1)];
    if (nextStep) {
      setCurrentStepId(nextStep.id);
    }
  }

  async function generateMoveDocuments(move: NonNullable<MoveApiResponse["move"]>) {
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;

    function applyKamWatermark(doc: InstanceType<typeof jsPDF>, text = "KAM") {
      const pageCount = doc.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
        doc.setPage(pageIndex);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(64);
        doc.setTextColor(230, 230, 230);

        const stepX = 70;
        const stepY = 55;
        for (let y = -20; y < pageHeight + 40; y += stepY) {
          for (let x = -30; x < pageWidth + 40; x += stepX) {
            (doc as unknown as { text: (t: string, x: number, y: number, opts?: Record<string, unknown>) => void }).text(
              text,
              x,
              y,
              { angle: 35, align: "center" },
            );
          }
        }
      }
    }

    const companyResponse = await fetch("/api/settings/company", { cache: "no-store" });
    const companyPayload = await readJsonResponseOrThrow<{ organization?: Record<string, unknown> }>(companyResponse);
    const organization = companyPayload.organization ?? {};

    const orgName = String((organization as { name?: string }).name ?? "MoveScout");
    const orgLegalName = String((organization as { legalName?: string }).legalName ?? "");
    const orgVatId = String((organization as { vatId?: string }).vatId ?? "");
    const orgTaxNumber = String((organization as { taxNumber?: string }).taxNumber ?? "");
    const isSmallBusiness = Boolean((organization as { isSmallBusiness?: boolean }).isSmallBusiness ?? false);
    const vatRatePercent = Number((organization as { vatRatePercent?: number }).vatRatePercent ?? 19);
    const orgStreet = String((organization as { street?: string }).street ?? "");
    const orgPostalCode = String((organization as { postalCode?: string }).postalCode ?? "");
    const orgCity = String((organization as { city?: string }).city ?? "");
    const orgCountry = String((organization as { country?: string }).country ?? "");
    const orgEmail = String((organization as { email?: string }).email ?? "");
    const orgPhone = String((organization as { phone?: string }).phone ?? "");
    const orgWebsite = String((organization as { website?: string }).website ?? "");
    const orgBankName = String((organization as { bankName?: string }).bankName ?? "");
    const orgIban = String((organization as { iban?: string }).iban ?? "");
    const orgBic = String((organization as { bic?: string }).bic ?? "");
    const senderName = orgLegalName.trim() || orgName;

    const now = new Date();
    const dateLabel = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    const serviceDateLabel = (() => {
      const trimmed = wizardData.plannedDate.trim();
      if (!trimmed) {
        return "Nach Vereinbarung";
      }
      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        return "Nach Vereinbarung";
      }
      return parsed.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    })();
    const offerValidUntilLabel = (() => {
      const validUntil = new Date(now);
      validUntil.setDate(validUntil.getDate() + 14);
      return validUntil.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    })();
    const vatRate = Number.isFinite(vatRatePercent) ? vatRatePercent / 100 : 0.19;

    const customerNameLabel =
      wizardData.customer.company.trim() ||
      `${wizardData.customer.firstName} ${wizardData.customer.lastName}`.trim() ||
      move.customerNumber;
    const customerAddressLine = [wizardData.customer.street.trim(), wizardData.customer.houseNumber.trim()].filter(Boolean).join(" ");
    const customerLocationLine = [wizardData.customer.postalCode.trim(), wizardData.customer.city.trim()].filter(Boolean).join(" ");

    const routeSubtotal =
      routeCalculationData !== null
        ? routeCalculationData.pricing.distancePrice +
          routeCalculationData.pricing.walkingDistancePrice +
          routeCalculationData.pricing.accessPrice +
          routeCalculationData.pricing.noParkingZonePrice
        : 0;
    const furnitureSubtotal =
      routeCalculationData !== null
        ? routeCalculationData.pricing.furnitureVolumePrice +
          routeCalculationData.pricing.assemblyPrice +
          routeCalculationData.pricing.disassemblyPrice +
          routeCalculationData.pricing.disposalPrice
        : 0;

    const offerLineItems = [
      { label: "Route & Zugang", amount: routeSubtotal },
      { label: "Möbel & Services", amount: furnitureSubtotal },
      { label: "Zusatzleistungen Allgemein", amount: extrasTotalPrice },
      ...(wizardData.roomSelections.includes("kitchen") ? [{ label: "Küchenleistungen", amount: kitchenTotalPrice }] : []),
    ].filter((item) => item.amount > 0);

    const totalAmount = routeCalculationData ? grandTotalPrice : manualServicesTotalPrice;
    const showVat = !isSmallBusiness;
    const totalNet = showVat ? totalAmount / (1 + vatRate) : totalAmount;
    const vatAmount = showVat ? totalAmount - totalNet : 0;

    async function loadImageForPdf(imageUrl: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
      try {
        const response = await fetch(imageUrl, { cache: "no-store" });
        if (!response.ok) {
          return null;
        }

        const blob = await response.blob();
        const format = blob.type === "image/png" ? "PNG" : blob.type === "image/jpeg" ? "JPEG" : null;
        if (!format) {
          return null;
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Logo konnte nicht gelesen werden."));
          reader.onload = () => resolve(String(reader.result ?? ""));
          reader.readAsDataURL(blob);
        });

        if (!dataUrl.startsWith("data:")) {
          return null;
        }

        return { dataUrl, format };
      } catch {
        return null;
      }
    }

    const logoPath = String((organization as { logoPath?: string | null }).logoPath ?? "").trim();
    const logoUrl = logoPath ? `/api/documents/file?path=${encodeURIComponent(logoPath)}` : "";
    const logoImage = logoUrl ? await loadImageForPdf(logoUrl) : null;

    function drawDotPattern(doc: InstanceType<typeof jsPDF>, startX: number, startY: number) {
      doc.setFillColor(236, 236, 236);
      for (let y = startY; y <= startY + 22; y += 4.8) {
        for (let x = startX; x <= startX + 34; x += 4.8) {
          doc.circle(x, y, 0.6, "F");
        }
      }
    }

    function drawHeader(
      doc: InstanceType<typeof jsPDF>,
      title: string,
      metaLines: Array<{ label: string; value: string }>,
    ) {
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 100, "F");
      doc.setFillColor(255, 0, 127);
      doc.rect(0, 0, pageWidth, 4, "F");
      drawDotPattern(doc, pageWidth - 54, 10);

      if (logoImage) {
        doc.addImage(logoImage.dataUrl, logoImage.format, 14, 10, 34, 14);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(20, 20, 20);
        doc.text(orgName, 14, 20);
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
      const senderLines = [
        senderName,
        orgStreet,
        [orgPostalCode, orgCity].filter(Boolean).join(" "),
        orgCountry,
      ].filter(Boolean);
      doc.text(senderLines.join("\n"), 14, 30);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(255, 0, 127);
      doc.text(title.toUpperCase(), pageWidth - 14, 24, { align: "right" });

      const metaBoxX = pageWidth - 84;
      const metaBoxY = 30;
      const metaBoxW = 70;
      const metaBoxH = 30;
      doc.setFillColor(248, 248, 248);
      doc.setDrawColor(230, 230, 230);
      doc.roundedRect(metaBoxX, metaBoxY, metaBoxW, metaBoxH, 2, 2, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.8);
      doc.setTextColor(70, 70, 70);
      let rowY = metaBoxY + 6;
      metaLines
        .filter((line) => line.value.trim())
        .slice(0, 5)
        .forEach((line) => {
          doc.text(line.label, metaBoxX + 4, rowY);
          doc.setFont("helvetica", "bold");
          doc.text(line.value, metaBoxX + metaBoxW - 4, rowY, { align: "right" });
          doc.setFont("helvetica", "normal");
          rowY += 6;
        });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text("Rechnungsempfänger", 14, 58);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text([customerNameLabel, customerAddressLine, customerLocationLine].filter(Boolean).join("\n"), 14, 64);

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.35);
      doc.line(14, 86, pageWidth - 14, 86);
    }

    function drawRepeatedHeader(doc: InstanceType<typeof jsPDF>, title: string) {
      const pageWidth = doc.internal.pageSize.getWidth();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 20, "F");
      doc.setFillColor(255, 0, 127);
      doc.rect(0, 0, pageWidth, 3, "F");

      if (logoImage) {
        doc.addImage(logoImage.dataUrl, logoImage.format, 14, 6, 22, 9);
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(20, 20, 20);
        doc.text(orgName, 14, 13);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 0, 127);
      doc.text(title.toUpperCase(), pageWidth - 14, 13, { align: "right" });
    }

    function drawFooter(doc: InstanceType<typeof jsPDF>) {
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const totalPages = doc.getNumberOfPages();
      const currentPage = (doc as unknown as { internal?: { getCurrentPageInfo?: () => { pageNumber: number } } }).internal?.getCurrentPageInfo?.()
        ?.pageNumber ?? totalPages;

      const barHeight = 22;
      const barY = pageHeight - barHeight;
      doc.setFillColor(18, 18, 18);
      doc.rect(0, barY, pageWidth, barHeight, "F");
      doc.setFillColor(255, 0, 127);
      doc.rect(0, pageHeight - 3, pageWidth, 3, "F");
      doc.setFillColor(255, 0, 127);
      doc.triangle(0, barY, 30, barY, 0, barY + 20, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      doc.setTextColor(235, 235, 235);

      const leftLine1 = senderName || orgName;
      const leftLine2 = [orgStreet, [orgPostalCode, orgCity].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      const contactLine = [orgPhone.trim() ? `Tel: ${orgPhone.trim()}` : "", orgEmail.trim() ? orgEmail.trim() : ""].filter(Boolean).join(" · ");
      const webLine = orgWebsite.trim() ? orgWebsite.trim() : "";

      const bankLine1 = orgBankName.trim() ? orgBankName.trim() : "";
      const bankLine2 = orgIban.trim()
        ? `IBAN ${orgIban.trim()}${orgBic.trim() ? ` · BIC ${orgBic.trim()}` : ""}`
        : "";
      const taxLine1 = orgTaxNumber.trim() ? `Steuernr. ${orgTaxNumber.trim()}` : "";
      const taxLine2 = orgVatId.trim() ? `USt-IdNr. ${orgVatId.trim()}` : "";

      const col2X = Math.round(pageWidth * 0.52);
      doc.text(leftLine1, 14, barY + 7);
      doc.text([leftLine2, orgCountry].filter(Boolean).join(" · "), 14, barY + 12);
      doc.text([contactLine, webLine].filter(Boolean).join(" · "), 14, barY + 17);

      doc.text(bankLine1, col2X, barY + 7);
      doc.text(bankLine2, col2X, barY + 12);
      doc.text([taxLine1, taxLine2].filter(Boolean).join(" · "), col2X, barY + 17);

      doc.text(`Seite ${currentPage} / ${totalPages}`, pageWidth - 14, barY + 17, { align: "right" });
    }

    function buildOfferPdf(kind: "Angebot" | "Rechnung") {
      const doc = new jsPDF({ format: "a4", unit: "mm" });
      const docNumber = kind === "Angebot" ? `ANG-${move.moveNumber}` : `RE-${move.moveNumber}`;
      drawHeader(doc, kind, [
        { label: kind === "Angebot" ? "Angebotsnummer" : "Rechnungsnummer", value: docNumber },
        { label: "Dokumentdatum", value: dateLabel },
        { label: "Leistungsdatum", value: serviceDateLabel },
        { label: "Vorgang", value: move.moveNumber },
        { label: "Kunde", value: move.customerNumber },
      ]);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(50, 50, 50);
      const intro =
        kind === "Angebot"
          ? `Vielen Dank für deine Anfrage. Dieses Angebot ist gültig bis ${offerValidUntilLabel}.`
          : "Vielen Dank. Unten findest du die abgerechneten Positionen.";
      doc.text(intro, 14, 94);
      doc.setFontSize(9.5);
      doc.setTextColor(90, 90, 90);
      doc.text(`Leistung: Umzugsdienstleistung gemäß Vorgang ${move.moveNumber} (${serviceDateLabel}).`, 14, 100);
      doc.text(
        showVat
          ? `Preise: Bruttobeträge inkl. ${Number.isFinite(vatRatePercent) ? vatRatePercent : 19}% MwSt.`
          : "Preise: kein Umsatzsteuerausweis (Kleinunternehmer § 19 UStG).",
        14,
        105,
      );

      autoTable(doc, {
        startY: 112,
        head: [["Leistung", "Menge", "Einzelpreis", "Gesamt"]],
        body: offerLineItems.map((item) => [item.label, "1", priceFormatter.format(item.amount), priceFormatter.format(item.amount)]),
        styles: {
          font: "helvetica",
          fontSize: 10,
          cellPadding: 3,
          textColor: [30, 30, 30],
        },
        headStyles: {
          fillColor: [255, 0, 127],
          textColor: [255, 255, 255],
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        columnStyles: {
          1: { cellWidth: 20, halign: "center" },
          2: { cellWidth: 32, halign: "right" },
          3: { cellWidth: 32, halign: "right" },
        },
        didDrawPage: (data) => {
          if (data.pageNumber > 1) {
            drawRepeatedHeader(doc, kind);
          }
          drawFooter(doc);
        },
        margin: { left: 14, right: 14, top: 30, bottom: 30 },
      });

      const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 160;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const barHeight = 22;
      const footerSafeY = pageHeight - barHeight - 6;
      let blockTopY = finalY + 10;

      if (blockTopY > footerSafeY - 46) {
        doc.addPage();
        drawRepeatedHeader(doc, kind);
        drawFooter(doc);
        blockTopY = 34;
      }

      const paymentBoxX = 14;
      const paymentBoxY = blockTopY;
      const paymentBoxW = 92;
      const paymentBoxH = 36;
      doc.setFillColor(248, 248, 248);
      doc.setDrawColor(230, 230, 230);
      doc.roundedRect(paymentBoxX, paymentBoxY, paymentBoxW, paymentBoxH, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(kind === "Angebot" ? "Zahlungsinformationen" : "Zahlungsinformationen", paymentBoxX + 4, paymentBoxY + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);
      const paymentLines = [
        orgBankName.trim() ? `Bank: ${orgBankName.trim()}` : "",
        orgIban.trim() ? `IBAN: ${orgIban.trim()}` : "",
        orgBic.trim() ? `BIC: ${orgBic.trim()}` : "",
        kind === "Rechnung" ? `Verwendungszweck: ${docNumber}` : "",
      ].filter(Boolean);
      doc.text(paymentLines.join("\n"), paymentBoxX + 4, paymentBoxY + 13);

      const summaryBoxW = 70;
      const summaryBoxX = pageWidth - 14 - summaryBoxW;
      const summaryBoxY = blockTopY;
      const summaryBoxH = showVat ? 42 : 32;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(230, 230, 230);
      doc.roundedRect(summaryBoxX, summaryBoxY, summaryBoxW, summaryBoxH, 2, 2, "FD");

      const labelX = summaryBoxX + 4;
      const valueX = summaryBoxX + summaryBoxW - 4;
      let y = summaryBoxY + 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);

      if (showVat) {
        doc.text("Netto", labelX, y);
        doc.setFont("helvetica", "bold");
        doc.text(priceFormatter.format(totalNet), valueX, y, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 6;
        doc.text(`MwSt. (${Number.isFinite(vatRatePercent) ? vatRatePercent : 19}%)`, labelX, y);
        doc.setFont("helvetica", "bold");
        doc.text(priceFormatter.format(vatAmount), valueX, y, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 7;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text(kind === "Angebot" ? "Summe (brutto)" : "Rechnungsbetrag", labelX, y);
      doc.text(priceFormatter.format(totalAmount), valueX, y, { align: "right" });

      if (!showVat) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.8);
        doc.setTextColor(90, 90, 90);
        doc.text("Kleinunternehmer § 19 UStG", summaryBoxX + summaryBoxW / 2, summaryBoxY + summaryBoxH - 5, { align: "center" });
      }

      if (kind === "Rechnung") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 70);
        doc.text(`Zahlungsziel: 14 Tage netto.`, 14, paymentBoxY + paymentBoxH + 10);
      }

      return doc;
    }

	    function buildChecklistPdf() {
	      const doc = new jsPDF({ format: "a4", unit: "mm" });
	      const pageWidth = doc.internal.pageSize.getWidth();
	      drawHeader(doc, "Möbelcheckliste", [
	        { label: "Dokumentdatum", value: dateLabel },
	        { label: "Leistungsdatum", value: serviceDateLabel },
	        { label: "Vorgang", value: move.moveNumber },
	        { label: "Kunde", value: move.customerNumber },
	      ]);

	      const infoBoxX = 14;
	      const infoBoxY = 94;
	      const infoBoxW = pageWidth - 28;
	      const infoBoxH = 26;
	      doc.setFillColor(248, 248, 248);
	      doc.setDrawColor(230, 230, 230);
	      doc.roundedRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH, 2, 2, "FD");
	      doc.setFont("helvetica", "bold");
	      doc.setFontSize(10);
	      doc.setTextColor(20, 20, 20);
	      doc.text("Route & Parksituation", infoBoxX + 4, infoBoxY + 7);
	      doc.setFont("helvetica", "normal");
	      doc.setFontSize(9);
	      doc.setTextColor(70, 70, 70);

	      const routeInfoLine = routeCalculationData
	        ? `Route: ${routeDistanceLabel} · ${routeDurationLabel}`
	        : "Route: nicht berechnet (bitte im Formular nachtragen).";
	      const sequenceInfoLine = routeSequenceLabel ? `Reihenfolge: ${routeSequenceLabel}` : "";

	      const parkingLines: string[] = [];
	      const outParking = wizardData.moveOutAddress.parkingSituation.trim() || "keine Angabe";
	      parkingLines.push(`Auszug: ${outParking}`);
	      wizardData.stopAddresses
	        .filter((stop) => hasAnyAddressData(stop))
	        .forEach((stop, index) => {
	          const text = stop.parkingSituation.trim() || "keine Angabe";
	          parkingLines.push(`Stopp ${index + 1}: ${text}`);
	        });
	      const inParking = wizardData.moveInAddress.parkingSituation.trim() || "keine Angabe";
	      parkingLines.push(`Einzug: ${inParking}`);

	      const infoTextLines = [routeInfoLine, sequenceInfoLine, `Parken: ${parkingLines.join(" | ")}`].filter(Boolean);
	      doc.text(infoTextLines.join("\n"), infoBoxX + 4, infoBoxY + 13, { maxWidth: infoBoxW - 8 });

	      const rows = getRoomLabelsFromSelectionIds(wizardData.roomSelections).flatMap((roomLabel) => {
	        const furnitureNames = wizardData.furnitureSelections
	          .filter((furniture) => furniture.room === roomLabel)
	          .map((furniture) => furniture.furnitureName)
	          .sort((a, b) => a.localeCompare(b, "de"));

        return [
          ["", `RAUM: ${roomLabel}`],
          ...furnitureNames.map((name) => ["[ ]", name]),
          ["", ""],
        ];
      });

	      autoTable(doc, {
	        startY: infoBoxY + infoBoxH + 8,
	        head: [["", "Möbel / Leistung"]],
	        body: rows as unknown as string[][],
	        styles: {
	          font: "helvetica",
          fontSize: 10,
          cellPadding: 3,
          textColor: [30, 30, 30],
        },
        headStyles: {
          fillColor: [255, 0, 127],
          textColor: [255, 255, 255],
        },
        columnStyles: {
          0: { cellWidth: 14, halign: "center" },
          1: { cellWidth: "auto" },
        },
        didParseCell(data) {
          const raw = (data as unknown as { row?: { raw?: unknown } }).row?.raw;
          if (Array.isArray(raw) && raw[1] && String(raw[1]).startsWith("RAUM:")) {
            const cellStyles = (data as unknown as { cell?: { styles?: Record<string, unknown> } }).cell?.styles;
            if (cellStyles) {
              cellStyles.fontStyle = "bold";
              cellStyles.textColor = [255, 0, 127];
            }
          }
        },
        didDrawPage: (data) => {
          // For page 1 we keep the full header; from page 2 onwards we render the compact header.
          if (data.pageNumber > 1) {
            drawRepeatedHeader(doc, "Möbelcheckliste");
          }
          drawFooter(doc);
        },
        margin: { left: 14, right: 14, top: 30, bottom: 30 },
      });

      return doc;
    }

    const offerPdf = buildOfferPdf("Angebot");
    const invoicePdf = buildOfferPdf("Rechnung");
    const checklistPdf = buildChecklistPdf();

    applyKamWatermark(offerPdf);
    applyKamWatermark(invoicePdf);
    applyKamWatermark(checklistPdf);

    const files = [
      { label: "Angebot", fileName: `Angebot-${move.moveNumber}.pdf`, blob: offerPdf.output("blob") as Blob },
      { label: "Rechnung", fileName: `Rechnung-${move.moveNumber}.pdf`, blob: invoicePdf.output("blob") as Blob },
      { label: "Möbelcheckliste", fileName: `Moebelcheckliste-${move.moveNumber}.pdf`, blob: checklistPdf.output("blob") as Blob },
    ];

    const uploaded: Array<{ fileName: string; fileUrl: string; label: string; relativePath: string }> = [];

    for (const file of files) {
      const formData = new FormData();
      formData.set("scope", "move");
      formData.set("customerNumber", move.customerNumber);
      formData.set("moveNumber", move.moveNumber);
      formData.set("file", new File([file.blob], file.fileName, { type: "application/pdf" }));

      const response = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const payload = await readJsonResponseOrThrow<{ fileName?: string; fileUrl?: string; relativePath?: string; message?: string }>(
        response,
      );

      if (!response.ok || !payload.fileUrl || !payload.fileName || !payload.relativePath) {
        throw new Error(payload.message ?? "PDF Upload fehlgeschlagen.");
      }

      uploaded.push({ fileName: payload.fileName, fileUrl: payload.fileUrl, relativePath: payload.relativePath, label: file.label });
    }

    window.dispatchEvent(new Event("movescout:documents-library-refresh"));
    return uploaded;
  }

  async function createMoveAndGenerateDocuments() {
    if (isSavingMove || isGeneratingDocuments) {
      return;
    }

    if (!routeCalculationData) {
      setSaveErrorMessage("Bitte zuerst Auszug und Einzug vollständig erfassen, damit Route und Preis berechnet werden können.");
      return;
    }

    setIsSavingMove(true);
    setIsGeneratingDocuments(true);
    setSaveErrorMessage("");

    try {
      const effectiveOptions = editingMoveMeta ? { ...options, customerId: editingMoveMeta.customerId } : options;
      let payload = buildMoveCreatePayload(effectiveOptions, wizardData);

      if (!editingMoveMeta && !payload.customerId && payload.customer) {
        try {
          const lookupResponse = await fetch("/api/customers/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company: payload.customer.company,
              firstName: payload.customer.firstName,
              lastName: payload.customer.lastName,
              address: payload.customer.address,
              postalCode: payload.customer.postalCode,
              city: payload.customer.city,
              email: payload.customer.email,
            }),
          });

          const lookupPayload =
            (await readJsonResponse<{ customer?: { id: string; customerNumber: string; company: string | null; firstName: string; lastName: string; city: string; postalCode: string } }>(
              lookupResponse,
            )) ?? {};

          const found = lookupPayload.customer;
          if (lookupResponse.ok && found?.id) {
            const displayName =
              (found.company?.trim() ? found.company.trim() : `${found.firstName} ${found.lastName}`.trim()) || found.customerNumber;
            const confirmed = window.confirm(
              `Diesen Kunden übernehmen?\n\n${displayName}\n${found.customerNumber}\n${found.postalCode} ${found.city}\n\nJa = übernehmen\nNein = neuen Kunden anlegen`,
            );

            if (confirmed) {
              payload = {
                ...payload,
                customerId: found.id,
                customer: undefined,
              };
            }
          }
        } catch {
          // Lookup ist optional; wenn es fehlschlägt, legen wir wie bisher einen neuen Kunden an.
        }
      }

      const pricingSummary = {
        routeBasePrice,
        extrasTotalPrice,
        kitchenTotalPrice,
        manualServicesTotalPrice,
        grandTotalPrice: routeCalculationData ? grandTotalPrice : null,
        computedAt: new Date().toISOString(),
      };

      function formatWizardAddress(address: { street: string; houseNumber: string; postalCode: string; city: string }) {
        const streetLine = [address.street.trim(), address.houseNumber.trim()].filter(Boolean).join(" ");
        const cityLine = [address.postalCode.trim(), address.city.trim()].filter(Boolean).join(" ");
        return [streetLine, cityLine].filter(Boolean).join(", ");
      }

      let moveForDocuments: MoveApiResponse["move"];

      if (editingMoveMeta) {
        const patchResponse = await fetch(`/api/moves/${encodeURIComponent(editingMoveMeta.id)}`, {
          body: JSON.stringify({
            status: payload.plannedDate ? "PLANNED" : undefined,
            plannedStartDate: payload.plannedDate || null,
            originAddress: formatWizardAddress(payload.moveOutAddress),
            destinationAddress: formatWizardAddress(payload.moveInAddress),
            wizardData: payload.wizardData,
            pricingSummary,
          }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        });

        const patchPayload = (await readJsonResponse<{ message?: string }>(patchResponse)) ?? {};
        if (!patchResponse.ok) {
          throw new Error(patchPayload.message ?? "Der Umzug konnte nicht gespeichert werden.");
        }

        moveForDocuments = {
          id: editingMoveMeta.id,
          moveNumber: editingMoveMeta.moveNumber,
          customerId: editingMoveMeta.customerId,
          customerNumber: editingMoveMeta.customerNumber,
          customerName: editingMoveMeta.customerName,
          originAddress: formatWizardAddress(payload.moveOutAddress),
          destinationAddress: formatWizardAddress(payload.moveInAddress),
          plannedDate: payload.plannedDate ? new Date(payload.plannedDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Noch kein Termin",
          status: payload.plannedDate ? "PLANNED" : "LEAD",
          documentCount: 0,
        };
      } else {
        const response = await fetch("/api/moves", {
          body: JSON.stringify({ ...payload, pricingSummary }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const responsePayload = (await readJsonResponse<MoveApiResponse>(response)) ?? ({} as MoveApiResponse);

        if (!response.ok || !responsePayload.move) {
          throw new Error(responsePayload.message || "Der Umzug konnte nicht angelegt werden.");
        }

        moveForDocuments = responsePayload.move;
      }

      const uploadedDocs = await generateMoveDocuments(moveForDocuments);
      setGeneratedDocuments(uploadedDocs);
      options?.onCreated?.();
      setCurrentStepId("downloads");
    } catch (error) {
      setSaveErrorMessage(error instanceof Error ? error.message : "Umzug konnte nicht angelegt werden.");
    } finally {
      setIsSavingMove(false);
      setIsGeneratingDocuments(false);
    }
  }

  function renderCurrentStep() {
    if (currentStep.id === "customer") {
      return (
        <section className={chrome.panel}>
          <h3 className={chrome.sectionTitle}>Seite 1: Kundendaten</h3>
          <p className={chrome.sectionText}>Firma, Anrede, Kontaktname und Anschrift des Kunden.</p>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <FieldLabel htmlFor="wizard-company" label="Firma" lightMode={lightMode}>
              <input
                id="wizard-company"
                value={wizardData.customer.company}
                onChange={(event) => updateCustomerField("company", event.target.value)}
                className={chrome.input}
                placeholder="Firma"
              />
            </FieldLabel>
            <FieldLabel htmlFor="wizard-salutation" label="Anrede" lightMode={lightMode}>
              <select
                id="wizard-salutation"
                value={wizardData.customer.salutation}
                onChange={(event) => updateCustomerField("salutation", event.target.value)}
                className={chrome.input}
              >
                <option value="">Bitte wählen</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
                <option value="Divers">Divers</option>
                <option value="Firma">Firma</option>
              </select>
            </FieldLabel>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <FieldLabel htmlFor="wizard-first-name" label="Vorname" lightMode={lightMode}>
              <input
                id="wizard-first-name"
                value={wizardData.customer.firstName}
                onChange={(event) => updateCustomerField("firstName", event.target.value)}
                className={chrome.input}
                placeholder="Vorname"
              />
            </FieldLabel>
            <FieldLabel htmlFor="wizard-last-name" label="Zuname" lightMode={lightMode}>
              <input
                id="wizard-last-name"
                value={wizardData.customer.lastName}
                onChange={(event) => updateCustomerField("lastName", event.target.value)}
                className={chrome.input}
                placeholder="Nachname"
              />
            </FieldLabel>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(120px,0.8fr)]">
            <FieldLabel htmlFor="wizard-street" label="Straße" lightMode={lightMode}>
              <input
                id="wizard-street"
                value={wizardData.customer.street}
                onChange={(event) => updateCustomerField("street", event.target.value)}
                className={chrome.input}
                placeholder="Straße"
              />
            </FieldLabel>
            <FieldLabel htmlFor="wizard-house-number" label="Hausnummer" lightMode={lightMode}>
              <input
                id="wizard-house-number"
                value={wizardData.customer.houseNumber}
                onChange={(event) => updateCustomerField("houseNumber", event.target.value)}
                className={chrome.input}
                placeholder="Nr."
              />
            </FieldLabel>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
            <FieldLabel htmlFor="wizard-postal-code" label="PLZ" lightMode={lightMode}>
              <input
                id="wizard-postal-code"
                value={wizardData.customer.postalCode}
                onChange={(event) => updateCustomerField("postalCode", event.target.value)}
                className={chrome.input}
                placeholder="PLZ"
              />
            </FieldLabel>
            <FieldLabel htmlFor="wizard-city" label="Ort" lightMode={lightMode}>
              <input
                id="wizard-city"
                value={wizardData.customer.city}
                onChange={(event) => updateCustomerField("city", event.target.value)}
                className={chrome.input}
                placeholder="Ort"
              />
            </FieldLabel>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <FieldLabel htmlFor="wizard-email" label="E-Mail (optional)" lightMode={lightMode}>
              <input
                id="wizard-email"
                value={wizardData.customer.email}
                onChange={(event) => updateCustomerField("email", event.target.value)}
                className={chrome.input}
                inputMode="email"
                placeholder="kunde@beispiel.de"
              />
            </FieldLabel>
            <div className={`${chrome.compactSurfaceMuted} text-sm`}>
              Wenn E-Mail vorhanden ist, erkennen wir bestehende Kunden zuverlässiger und vermeiden doppelte Anlegen.
            </div>
          </div>
        </section>
      );
    }

    if (currentStep.id === "addresses") {
      return (
        <div className="grid gap-4">
          <section className={chrome.panel}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className={chrome.sectionTitle}>Seite 2: Adressen</h3>
                <p className={chrome.sectionText}>
                  Auszug, optionale Zwischenstopps und Einzug mit denselben Detailfeldern.
                </p>
              </div>
              <button type="button" onClick={addStopAddress} className={`${chrome.actionButton} inline-flex items-center gap-2`}>
                <Plus className="h-4 w-4" />
                Zwischenstopp hinzufügen
              </button>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <div className={`${chrome.subtleInset} flex items-start gap-3`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  lightMode ? "bg-white text-[#FF007F] ring-1 ring-zinc-200" : "bg-zinc-950 text-[#ff8cc5] ring-1 ring-white/10"
                }`}>
                  <MapPin className="h-5 w-5" strokeWidth={1.9} />
                </div>
                <div>
                  <p className={chrome.statLabel}>Adressen</p>
                  <p className={`mt-2 text-2xl font-semibold ${chrome.bodyText}`}>{addressSectionCount}</p>
                  <p className={`mt-1 text-sm ${chrome.mutedText}`}>
                    {wizardData.stopAddresses.length > 0 ? "Auszug, Stopps und Einzug in der Route." : "Auszug und Einzug sind gesetzt."}
                  </p>
                  <p className="mt-2 text-xs text-[#FF007F]">
                    {customerAddressSummary !== "Noch keine Adresse erfasst"
                      ? "Kundenadresse kann fuer Auszug oder Einzug uebernommen werden."
                      : "Kundenadresse zuerst im ersten Schritt erfassen."}
                  </p>
                </div>
              </div>

              <div className={`${chrome.subtleInset} flex items-start gap-3`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  lightMode ? "bg-white text-[#FF007F] ring-1 ring-zinc-200" : "bg-zinc-950 text-[#ff8cc5] ring-1 ring-white/10"
                }`}>
                  <Route className="h-5 w-5" strokeWidth={1.9} />
                </div>
                <div>
                  <p className={chrome.statLabel}>Zwischenstopps</p>
                  <p className={`mt-2 text-2xl font-semibold ${chrome.bodyText}`}>{wizardData.stopAddresses.length}</p>
                  <p className={`mt-1 text-sm ${chrome.mutedText}`}>
                    {wizardData.stopAddresses.length > 0 ? "Route mit Zusatzstopps" : "Direkte Route ohne Zwischenhalt"}
                  </p>
                  <p className="mt-2 text-xs text-[#FF007F]">
                    {addressSectionCount - 1} Etappe{addressSectionCount - 1 === 1 ? "" : "n"} zwischen Start und Ziel.
                  </p>
                </div>
              </div>

              <div className={`${chrome.subtleInset} flex items-start gap-3`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  lightMode ? "bg-white text-[#FF007F] ring-1 ring-zinc-200" : "bg-zinc-950 text-[#ff8cc5] ring-1 ring-white/10"
                }`}>
                  <ArrowRightLeft className="h-5 w-5" strokeWidth={1.9} />
                </div>
                <div>
                  <p className={chrome.statLabel}>Laufmeter gesamt</p>
                  <p className={`mt-2 text-2xl font-semibold ${chrome.bodyText}`}>{totalWalkingDistanceLabel}</p>
                  <p className={`mt-1 text-sm ${chrome.mutedText}`}>Summe aller erfassten Fußwege aus Auszug, Stopps und Einzug.</p>
                  <p className="mt-2 text-xs text-[#FF007F]">
                    {routeStartLabel} {"->"} {routeEndLabel}
                  </p>
                </div>
              </div>

              <div className={`${chrome.subtleInset} flex items-start gap-3`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  lightMode ? "bg-white text-[#FF007F] ring-1 ring-zinc-200" : "bg-zinc-950 text-[#ff8cc5] ring-1 ring-white/10"
                }`}>
                  <Route className="h-5 w-5" strokeWidth={1.9} />
                </div>
                <div>
                  <p className={chrome.statLabel}>Fahrstrecke</p>
                  <p className={`mt-2 text-2xl font-semibold ${chrome.bodyText}`}>{routeDistanceLabel}</p>
                  <p className={`mt-1 text-sm ${chrome.mutedText}`}>{routeDurationLabel}</p>
                  <p className="mt-2 text-xs text-[#FF007F]">
                    {routeCalculationData
                      ? routeCalculationData.provider === "osrm"
                        ? "Schnellste Route berechnet"
                        : "Fallback mit Luftlinien-Näherung aktiv"
                      : "Wird live aus der API geladen"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <AddressSectionCard
            address={wizardData.moveOutAddress}
            chrome={chrome}
            customerAddressButtonLabel="Kundenadresse als Auszug"
            customerAddressSummary={customerAddressSummary}
            kind="move-out"
            lightMode={lightMode}
            onApplyCustomerAddress={() => applyCustomerAddressToRootAddress("moveOutAddress")}
            onToggleBooleanField={(field, value) => toggleRootAddressBooleanField("moveOutAddress", field, value)}
            onUpdateField={(field, value) => updateRootAddressField("moveOutAddress", field, value)}
            title="Auszug"
          />

          {wizardData.stopAddresses.map((stopAddress, index) => (
            <AddressSectionCard
              key={stopAddress.id}
              address={stopAddress}
              chrome={chrome}
              index={index}
              kind="stop"
              lightMode={lightMode}
              onRemove={() => removeStopAddress(stopAddress.id)}
              onToggleBooleanField={(field, value) => toggleStopAddressBooleanField(stopAddress.id, field, value)}
              onUpdateField={(field, value) => updateStopAddressField(stopAddress.id, field, value)}
              title={`Zwischenstopp ${index + 1}`}
            />
          ))}

          <AddressSectionCard
            address={wizardData.moveInAddress}
            chrome={chrome}
            customerAddressButtonLabel="Kundenadresse als Einzug"
            customerAddressSummary={customerAddressSummary}
            kind="move-in"
            lightMode={lightMode}
            onApplyCustomerAddress={() => applyCustomerAddressToRootAddress("moveInAddress")}
            onToggleBooleanField={(field, value) => toggleRootAddressBooleanField("moveInAddress", field, value)}
            onUpdateField={(field, value) => updateRootAddressField("moveInAddress", field, value)}
            title="Einzugsadresse"
          />

          <section className={chrome.panel}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className={chrome.sectionTitle}>Route und Preis</h3>
                <p className={chrome.sectionText}>
                  Schnellste Fahrstrecke, logische Stoppreihenfolge und die kompakte Preisaufschlüsselung für die
                  aktuelle Route.
                </p>
              </div>
              {stopOrderChanged ? (
                <button type="button" onClick={applyCalculatedStopOrder} className={chrome.actionButton}>
                  Stoppreihenfolge übernehmen
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-4">
              <div className={`${chrome.subtleInset} min-h-[7.5rem]`}>
                <p className={chrome.statLabel}>Gesamtpreis</p>
                <p className={`mt-2 text-3xl font-semibold ${chrome.bodyText}`}>{livePriceLabel}</p>
              </div>

              <div className={`${chrome.subtleInset} min-h-[7.5rem]`}>
                <p className={chrome.statLabel}>Fahrstrecke</p>
                <p className={`mt-2 text-2xl font-semibold ${chrome.bodyText}`}>{routeDistanceLabel}</p>
                <p className={`mt-1 text-sm ${chrome.mutedText}`}>{routeDurationLabel}</p>
              </div>

              <div className={`${chrome.subtleInset} min-h-[7.5rem]`}>
                <p className={chrome.statLabel}>Zugang & Etagen</p>
                <p className={`mt-2 text-2xl font-semibold ${chrome.bodyText}`}>{accessAndAddressPrice}</p>
                <p className={`mt-1 text-sm ${chrome.mutedText}`}>Laufmeter, Stockwerk/Aufzug und Halteverbot zusammen.</p>
              </div>

              <div className={`${chrome.subtleInset} min-h-[7.5rem]`}>
                <p className={chrome.statLabel}>Möbel & Services</p>
                <p className={`mt-2 text-2xl font-semibold ${chrome.bodyText}`}>{furnitureAndServicePrice}</p>
                <p className={`mt-1 text-sm ${chrome.mutedText}`}>Kubikmeterpreis, Aufbau, Abbau und Entrümpelung.</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3">
              {acuteMoveCalculationError ? (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ring-1 ${
                    lightMode
                      ? "bg-red-500/10 text-red-700 ring-red-500/20"
                      : "bg-red-500/12 text-red-200 ring-red-500/25"
                  }`}
                >
                  {acuteMoveCalculationError}
                </div>
              ) : null}

              {routeSequenceLabel ? (
                <div className={`${chrome.subtleInset} text-sm`}>
                  <p className={chrome.statLabel}>Berechnete Route</p>
                  <p className={`mt-2 leading-6 ${chrome.bodyText}`}>{routeSequenceLabel}</p>
                </div>
              ) : null}

              {routeStatusLabel ? <div className={`${chrome.compactSurfaceMuted} text-sm`}>{routeStatusLabel}</div> : null}

              {visibleMoveCalculationWarnings.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {visibleMoveCalculationWarnings.map((warning) => (
                    <div key={warning} className={`${chrome.compactSurfaceMuted} text-sm`}>
                      {warning}
                    </div>
                  ))}
                </div>
              ) : null}

              {routeCalculationData ? (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                    Fahrstrecke ({pricingConfig.pricePerKilometer} € / km): {priceFormatter.format(routeCalculationData.pricing.distancePrice)}
                  </div>
                  <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                    Laufmeter: {priceFormatter.format(routeCalculationData.pricing.walkingDistancePrice)}
                  </div>
                  <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                    Halteverbotszonen: {priceFormatter.format(routeCalculationData.pricing.noParkingZonePrice)}
                  </div>
                  <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                    Etagen/Aufzug: {priceFormatter.format(routeCalculationData.pricing.accessPrice)}
                  </div>
                  <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                    Möbelvolumen ({routeCalculationData.pricing.furnitureVolumeCubicMeters} m3): {priceFormatter.format(routeCalculationData.pricing.furnitureVolumePrice)}
                  </div>
                  <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                    Aufbau: {priceFormatter.format(routeCalculationData.pricing.assemblyPrice)}
                  </div>
                  <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                    Abbau: {priceFormatter.format(routeCalculationData.pricing.disassemblyPrice)}
                  </div>
                  <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                    Entrümpelung ({routeCalculationData.pricing.disposalVolumeCubicMeters} m3): {priceFormatter.format(routeCalculationData.pricing.disposalPrice)}
                  </div>
                </div>
              ) : null}

              {additionalAddressCharges.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {additionalAddressCharges.map((addressCharge) => (
                    <div key={addressCharge.addressId} className={`${chrome.compactSurfaceMuted} text-sm`}>
                      {getAddressKindLabel(addressCharge.addressKind)}: {addressCharge.addressLabel}
                      {addressCharge.accessPrice > 0
                        ? addressCharge.hasElevator
                          ? ` | Aufzug = ${priceFormatter.format(addressCharge.elevatorPrice)}`
                          : ` | ${addressCharge.floorLabel} = ${priceFormatter.format(addressCharge.floorPrice)}`
                        : ""}
                      {addressCharge.walkingDistancePrice > 0
                        ? ` | ${formatDistanceLabel(addressCharge.walkingDistanceMeters)} Laufweg = ${priceFormatter.format(addressCharge.walkingDistancePrice)}`
                        : ""}
                      {addressCharge.noParkingZonePrice > 0
                        ? ` | Halteverbot = ${priceFormatter.format(addressCharge.noParkingZonePrice)}`
                        : ""}
                    </div>
                  ))}
                </div>
              ) : routeCalculationData ? (
                <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                  Für die aktuelle Route gibt es noch keine Zusatzkosten aus Zugang, Laufmetern oder Halteverbotszonen.
                </div>
              ) : null}

              {additionalFurnitureCharges.length > 0 ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {additionalFurnitureCharges.map((furnitureCharge) => (
                    <div key={furnitureCharge.furnitureId} className={`${chrome.compactSurfaceMuted} text-sm`}>
                      {furnitureCharge.furnitureName} | {furnitureCharge.volumeCubicMeters} m3
                      {furnitureCharge.assemblyPrice > 0
                        ? ` | Aufbau = ${priceFormatter.format(furnitureCharge.assemblyPrice)}`
                        : ""}
                      {furnitureCharge.disassemblyPrice > 0
                        ? ` | Abbau = ${priceFormatter.format(furnitureCharge.disassemblyPrice)}`
                        : ""}
                      {furnitureCharge.disposalPrice > 0
                        ? ` | Entrümpelung = ${priceFormatter.format(furnitureCharge.disposalPrice)}`
                        : ""}
                    </div>
                  ))}
                </div>
              ) : routeCalculationData && routeCalculationData.pricing.furnitureCharges.length > 0 ? (
                <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                  Möbelvolumen gesamt: {routeCalculationData.pricing.furnitureVolumeCubicMeters} m3 | Kubikmeterpreis ={" "}
                  {priceFormatter.format(routeCalculationData.pricing.furnitureVolumePrice)}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      );
    }

    if (currentStep.id === "rooms") {
      return (
        <section className={chrome.panel}>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className={chrome.sectionTitle}>Seite 3: Raumauswahl</h3>
              <p className={chrome.sectionText}>Mehrfachauswahl ist erlaubt. Jede Karte funktioniert wie eine Checkbox.</p>
            </div>
            <div className={`${chrome.compactSurfaceMuted} text-sm`}>
              {selectedRoomCount > 0 ? `${selectedRoomCount} Räume ausgewählt` : "Noch keine Räume ausgewählt"}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roomOptions.map((room) => (
              <RoomSelectionButton
                key={room.id}
                icon={room.icon}
                isSelected={wizardData.roomSelections.includes(room.id)}
                label={room.label}
                lightMode={lightMode}
                onToggle={() => toggleRoomSelection(room.id)}
              />
            ))}
          </div>
        </section>
      );
    }

    if (currentStep.id === "furniture") {
      if (selectedRoomLabels.length === 0) {
        return (
          <section className={chrome.panel}>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className={chrome.sectionTitle}>Seite 4: Möbelauswahl</h3>
                <p className={chrome.sectionText}>Die Möbelauswahl richtet sich nach den zuvor markierten Räumen.</p>
              </div>
              <div className={`${chrome.compactSurfaceMuted} text-sm`}>Noch keine Räume ausgewählt</div>
            </div>

            <div className={`mt-4 ${chrome.emptyState}`}>
              Bitte zuerst in der Raumauswahl mindestens einen Raum markieren. Danach erscheinen hier die passenden
              Möbel-Kategorien, Standardmöbel und manuelle Auswahloptionen.
            </div>
          </section>
        );
      }

      return (
        <div className="grid gap-4">
          <section className={chrome.panel}>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className={chrome.sectionTitle}>Seite 4: Möbelauswahl</h3>
                <p className={chrome.sectionText}>
                  Möbel nach gewählten Räumen hinzufügen, Standardmöbel übernehmen und Zusatzleistungen direkt markieren.
                </p>
              </div>
              <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                {wizardData.furnitureSelections.length > 0
                  ? `${wizardData.furnitureSelections.length} Möbelkarten angelegt`
                  : "Noch keine Möbel hinzugefügt"}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className={`${chrome.subtleInset} flex items-start gap-3`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  lightMode ? "bg-white text-[#FF007F] ring-1 ring-zinc-200" : "bg-zinc-950 text-[#ff8cc5] ring-1 ring-white/10"
                }`}>
                  <MapPin className="h-5 w-5" strokeWidth={1.9} />
                </div>
                <div>
                  <p className={chrome.statLabel}>Raumkategorien</p>
                  <p className={`mt-2 text-2xl font-semibold ${chrome.bodyText}`}>{selectedRoomLabels.length}</p>
                  <p className={`mt-1 text-sm ${chrome.mutedText}`}>{selectedRoomLabels.join(", ")}</p>
                </div>
              </div>

              <div className={`${chrome.subtleInset} flex items-start gap-3`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  lightMode ? "bg-white text-[#FF007F] ring-1 ring-zinc-200" : "bg-zinc-950 text-[#ff8cc5] ring-1 ring-white/10"
                }`}>
                  <Plus className="h-5 w-5" strokeWidth={1.9} />
                </div>
                <div>
                  <p className={chrome.statLabel}>Möbelkarten</p>
                  <p className={`mt-2 text-2xl font-semibold ${chrome.bodyText}`}>{wizardData.furnitureSelections.length}</p>
                  <p className={`mt-1 text-sm ${chrome.mutedText}`}>Manuell hinzugefügt oder aus Standardmöbeln übernommen.</p>
                </div>
              </div>

              <div className={`${chrome.subtleInset} flex items-start gap-3`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  lightMode ? "bg-white text-[#FF007F] ring-1 ring-zinc-200" : "bg-zinc-950 text-[#ff8cc5] ring-1 ring-white/10"
                }`}>
                  <Sparkles className="h-5 w-5" strokeWidth={1.9} />
                </div>
                <div>
                  <p className={chrome.statLabel}>Standardmöbel offen</p>
                  <p className={`mt-2 text-2xl font-semibold ${chrome.bodyText}`}>{missingStandardFurnitureOptions.length}</p>
                  <p className={`mt-1 text-sm ${chrome.mutedText}`}>
                    {missingStandardFurnitureOptions.length > 0
                      ? "Diese Standardmöbel können gesammelt ergänzt werden."
                      : "Alle verfügbaren Standardmöbel sind bereits angelegt."}
                  </p>
                </div>
              </div>
            </div>

            <div className={`mt-4 ${chrome.subtleInset}`}>
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setFurniturePickerOpen((currentValue) => !currentValue)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      lightMode
                        ? "border-zinc-300 bg-white text-zinc-900 hover:border-[#FF007F]/40"
                        : "border-white/10 bg-zinc-950 text-zinc-100 hover:border-[#FF007F]/30"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="text-xs uppercase tracking-[0.18em] text-[#FF007F]">Manuelle Auswahl</span>
                      <span className="mt-1 block truncate text-sm font-medium">
                        {selectedFurnitureOption
                          ? `${selectedFurnitureOption.catalogItem.furnitureName} | ${selectedFurnitureOption.roomLabel} | ${getFurnitureCategoryLabel(selectedFurnitureOption.catalogItem.category)}`
                          : "Möbelstück aus ausgewählten Räumen wählen"}
                      </span>
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition ${furniturePickerOpen ? "rotate-180" : "rotate-0"}`} />
                  </button>

                  {furniturePickerOpen ? (
                    <div
                      className={`absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border ${
                        lightMode ? "border-zinc-200 bg-white shadow-2xl shadow-zinc-300/30" : "border-white/10 bg-zinc-950 shadow-2xl shadow-black/30"
                      }`}
                    >
                      <div className="border-b p-3">
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                          <div className="relative">
                            <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${chrome.mutedText}`} />
                            <input
                              value={furnitureSearch}
                              onChange={(event) => setFurnitureSearch(event.target.value)}
                              className={`${chrome.input} pl-9`}
                              placeholder="Nach Möbelstück oder Kategorie suchen"
                            />
                          </div>

                          <select
                            value={selectedFurnitureCategory}
                            onChange={(event) => {
                              const nextCategory = event.target.value as "all" | FurnitureCategoryId;

                              setSelectedFurnitureCategory(nextCategory);
                              setSelectedFurnitureOptionKey(null);
                            }}
                            className={chrome.input}
                          >
                            <option value="all">Alle Kategorien</option>
                            {furnitureCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="max-h-80 overflow-y-auto p-3">
                        <div className="grid gap-3">
                          {filteredFurnitureGroups.some((group) => group.options.length > 0) ? (
                            filteredFurnitureGroups.map((group) =>
                              group.options.length > 0 ? (
                                <section key={group.roomLabel} className="grid gap-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className={`text-sm font-semibold ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>{group.roomLabel}</h4>
                                    <span className={chrome.neutralChip}>{group.options.length}</span>
                                  </div>
                                  <div className="grid gap-2">
                                    {group.options.map((catalogItem) => {
                                      const optionKey = createFurnitureOptionKey(catalogItem.id, group.roomLabel);
                                      const isSelected = selectedFurnitureOptionKey === optionKey;

                                      return (
                                        <button
                                          key={optionKey}
                                          type="button"
                                          onClick={() => setSelectedFurnitureOptionKey(optionKey)}
                                          className={`rounded-xl border px-3 py-3 text-left transition ${
                                            isSelected
                                              ? lightMode
                                                ? "border-[#FF007F] bg-[#FF007F]/8 text-zinc-900"
                                                : "border-[#FF007F] bg-[#FF007F]/12 text-zinc-100"
                                              : lightMode
                                                ? "border-zinc-200 bg-zinc-50 text-zinc-900 hover:border-[#FF007F]/30"
                                                : "border-white/10 bg-zinc-900 text-zinc-100 hover:border-[#FF007F]/25"
                                          }`}
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                              <p className="font-medium">{catalogItem.furnitureName}</p>
                                              <p className={`mt-1 text-xs ${chrome.mutedText}`}>
                                                {catalogItem.lengthCm} x {catalogItem.widthCm} x {catalogItem.heightCm} cm
                                              </p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                              <span className={chrome.neutralChip}>{getFurnitureCategoryLabel(catalogItem.category)}</span>
                                              {catalogItem.standardRooms.includes(group.roomLabel) ? (
                                                <span className={chrome.chip}>Standard</span>
                                              ) : null}
                                            </div>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </section>
                              ) : null,
                            )
                          ) : (
                            <div className={`${chrome.emptyState} px-4 py-6`}>
                              Keine Möbel für die aktuelle Suche gefunden.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={addSelectedFurnitureOption}
                  disabled={!selectedFurnitureOption}
                  className={`${chrome.actionButton} inline-flex items-center justify-center gap-2`}
                >
                  <Plus className="h-4 w-4" />
                  Hinzufügen
                </button>

                <button
                  type="button"
                  onClick={addMissingStandardFurniture}
                  disabled={missingStandardFurnitureOptions.length === 0}
                  className={`${chrome.secondaryButton} inline-flex items-center justify-center gap-2`}
                >
                  <Sparkles className="h-4 w-4" />
                  Alle Standardmöbel hinzufügen
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <div className={chrome.compactSurfaceMuted}>
                  {availableFurnitureOptions.length} Möbeloptionen in {selectedRoomLabels.length} ausgewählten Räumen
                </div>
                <div className={chrome.compactSurfaceMuted}>
                  Filter: {selectedFurnitureCategory === "all" ? "Alle Kategorien" : getFurnitureCategoryLabel(selectedFurnitureCategory)}
                </div>
                <div className={chrome.compactSurfaceMuted}>
                  {missingStandardFurnitureOptions.length} Standardmöbel aktuell noch nicht übernommen
                </div>
              </div>
            </div>
          </section>

          {wizardData.furnitureSelections.length === 0 ? (
            <section className={chrome.panel}>
              <div className={chrome.emptyState}>
                Noch keine Möbel angelegt. Wähle oben ein Möbelstück manuell aus oder übernimm die Standardmöbel für die
                markierten Räume.
              </div>
            </section>
          ) : (
            furnitureSelectionsByRoom.map((group) => (
              <section key={group.roomLabel} className={chrome.panel}>
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h4 className={chrome.sectionTitle}>{group.roomLabel}</h4>
                    <p className={chrome.sectionText}>
                      {group.items.length} Möbelstück{group.items.length === 1 ? "" : "e"} in dieser Raumkategorie.
                    </p>
                  </div>
                  <div className={`${chrome.compactSurfaceMuted} text-sm`}>{group.items.length} Karten</div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {group.items.map((furniture) => (
                    <FurnitureSelectionCard
                      key={furniture.id}
                      chrome={chrome}
                      furniture={furniture}
                      lightMode={lightMode}
                      onRemove={() => removeFurnitureSelection(furniture.id)}
                      onToggleBooleanField={(field, value) => toggleFurnitureBooleanField(furniture.id, field, value)}
                      onUpdateDimensionField={(field, value) => updateFurnitureDimensionField(furniture.id, field, value)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      );
    }

    if (currentStep.id === "extras") {
      const ceilingLampLineTotal = handymanLampPrice + handymanHeightSurcharge;

      return (
        <div className="grid gap-4">
          <section className={chrome.panel}>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className={chrome.sectionTitle}>Seite 5: Zusatzleistungen Allgemein</h3>
                <p className={chrome.sectionText}>Handwerk, Bohren und Verpackungsmaterial inkl. Ein- und Auspackservice.</p>
              </div>
              <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                {manualServicesTotalPrice > 0 ? `Zusatz: ${priceFormatter.format(manualServicesTotalPrice)}` : "Noch keine Zusatzleistungen"}
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <article className={chrome.subtlePanel}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className={chrome.sectionTitle}>Handwerk</h4>
                    <p className={chrome.sectionText}>Lampenmontage und Bohrarbeiten.</p>
                  </div>
                  <div className={chrome.neutralChip}>{priceFormatter.format(handymanTotalPrice)}</div>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <FieldLabel label="Deckenlampen montieren (Anzahl)" lightMode={lightMode}>
                      <input
                        value={wizardData.extras.handyman.ceilingLampCount}
                        onChange={(event) => updateHandymanField("ceilingLampCount", event.target.value)}
                        className={chrome.input}
                        inputMode="numeric"
                        placeholder="0"
                      />
                    </FieldLabel>
                    <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                      {pricingConfig.ceilingLampInstallPricePerItem} EUR / Stk | {priceFormatter.format(handymanLampPrice)}
                    </div>
                  </div>

                  <TogglePriceRow
                    checked={wizardData.extras.handyman.ceilingHeightOver23m}
                    chrome={chrome}
                    label="Deckenhöhe über 2,3m"
                    hint={`Zuschlag ${pricingConfig.ceilingHeightSurcharge} EUR`}
                    lightMode={lightMode}
                    onChange={(checked) => toggleHandymanField("ceilingHeightOver23m", checked)}
                    priceLabel={priceFormatter.format(handymanHeightSurcharge)}
                  />

                  <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                    Lampen gesamt: {priceFormatter.format(ceilingLampLineTotal)}
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <FieldLabel label="Löcher für Gardinenstangen bohren (Anzahl Löcher)" lightMode={lightMode}>
                      <input
                        value={wizardData.extras.handyman.curtainRodHoleCount}
                        onChange={(event) => updateHandymanField("curtainRodHoleCount", event.target.value)}
                        className={chrome.input}
                        inputMode="numeric"
                        placeholder="0"
                      />
                    </FieldLabel>
                    <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                      {pricingConfig.curtainRodHolePricePerItem} EUR / Loch | {priceFormatter.format(handymanCurtainRodHolesPrice)}
                    </div>
                  </div>
                </div>
              </article>

              <article className={chrome.subtlePanel}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className={chrome.sectionTitle}>Verpackungsmaterial</h4>
                    <p className={chrome.sectionText}>Mengen erfassen und optional Ein-/Auspacken aktivieren.</p>
                  </div>
                  <div className={chrome.neutralChip}>{priceFormatter.format(packingTotalPrice)}</div>
                </div>

                <div className="mt-4 grid gap-3">
                  {packingMaterialDefinitions.map((definition) => {
                    const selection = wizardData.extras.packing[definition.key satisfies PackingMaterialKey];
                    const quantityLabel =
                      definition.quantity > 0 ? `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(definition.quantity)} ${definition.unit}` : "0";
                    const materialPrice = definition.quantity * definition.unitPrice;
                    const packPrice = selection.pack ? definition.quantity * pricingConfig.packingPackPricePerItem : 0;
                    const unpackPrice = selection.unpack ? definition.quantity * pricingConfig.packingUnpackPricePerItem : 0;
                    const lineTotal = materialPrice + packPrice + unpackPrice;

                    return (
                      <div key={definition.key} className={`${chrome.subtleInset} grid gap-3`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{definition.label}</p>
                            <p className={`mt-1 text-xs ${chrome.mutedText}`}>
                              Material: {definition.unitPrice} EUR / {definition.unit} | Einpacken: {pricingConfig.packingPackPricePerItem} EUR / Einheit | Auspacken: {pricingConfig.packingUnpackPricePerItem} EUR / Einheit
                            </p>
                          </div>
                          <div className={chrome.neutralChip}>
                            {definition.quantity > 0 ? `${quantityLabel} | ${priceFormatter.format(lineTotal)}` : "Leer"}
                          </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
                          <FieldLabel label={`Menge (${definition.unit})`} lightMode={lightMode}>
                            <input
                              value={wizardData.extras.packing[definition.key].quantity}
                              onChange={(event) => updatePackingQuantity(definition.key, event.target.value)}
                              className={chrome.input}
                              inputMode="decimal"
                              placeholder="0"
                            />
                          </FieldLabel>
                          <div className="grid gap-2">
                            <TogglePriceRow
                              checked={selection.unpack}
                              chrome={chrome}
                              label="Auspacken"
                              hint={`${pricingConfig.packingUnpackPricePerItem} EUR / Einheit`}
                              lightMode={lightMode}
                              onChange={(checked) => togglePackingOption(definition.key, "unpack", checked)}
                              priceLabel={priceFormatter.format(unpackPrice)}
                            />
                            <TogglePriceRow
                              checked={selection.pack}
                              chrome={chrome}
                              label="Einpacken"
                              hint={`${pricingConfig.packingPackPricePerItem} EUR / Einheit`}
                              lightMode={lightMode}
                              onChange={(checked) => togglePackingOption(definition.key, "pack", checked)}
                              priceLabel={priceFormatter.format(packPrice)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>
          </section>
        </div>
      );
    }

    if (currentStep.id === "kitchen") {
      return (
        <section className={chrome.panel}>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className={chrome.sectionTitle}>Seite 6: Küchenleistungen</h3>
              <p className={chrome.sectionText}>Laufmeter Küche, Arbeitsplatten, E-Geräte und passende Optionen.</p>
            </div>
            <div className={`${chrome.compactSurfaceMuted} text-sm`}>
              {kitchenTotalPrice > 0 ? `Küche: ${priceFormatter.format(kitchenTotalPrice)}` : "Keine Küchenleistungen ausgewählt"}
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <article className={chrome.subtlePanel}>
              <h4 className={chrome.sectionTitle}>Mengen</h4>
              <p className={chrome.sectionText}>Diese Werte werden für die Optionen verwendet.</p>

              <div className="mt-4 grid gap-3">
                <FieldLabel label="Laufmeter Küche" lightMode={lightMode}>
                  <input
                    value={wizardData.kitchen.kitchenMeters}
                    onChange={(event) => updateKitchenField("kitchenMeters", event.target.value)}
                    className={chrome.input}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </FieldLabel>
                <FieldLabel label="Anzahl Arbeitsplatten" lightMode={lightMode}>
                  <input
                    value={wizardData.kitchen.countertopCount}
                    onChange={(event) => updateKitchenField("countertopCount", event.target.value)}
                    className={chrome.input}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </FieldLabel>
                <FieldLabel label="Anzahl E-Geräte" lightMode={lightMode}>
                  <input
                    value={wizardData.kitchen.applianceCount}
                    onChange={(event) => updateKitchenField("applianceCount", event.target.value)}
                    className={chrome.input}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </FieldLabel>
              </div>
            </article>

            <article className={chrome.subtlePanel}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className={chrome.sectionTitle}>Optionen</h4>
                  <p className={chrome.sectionText}>Aktivieren und Preis wird sofort berechnet.</p>
                </div>
                <div className={chrome.neutralChip}>{priceFormatter.format(kitchenTotalPrice)}</div>
              </div>

              <div className="mt-4 grid gap-3">
                <TogglePriceRow
                  checked={wizardData.kitchen.optionDisassembly}
                  chrome={chrome}
                  label="Abbau Küche"
                  hint={`${pricingConfig.kitchenDisassemblyPricePerMeter} EUR / m`}
                  lightMode={lightMode}
                  onChange={(checked) => toggleKitchenOption("optionDisassembly", checked)}
                  priceLabel={priceFormatter.format(kitchenDisassemblyPrice)}
                />

                <TogglePriceRow
                  checked={wizardData.kitchen.optionAssembly}
                  chrome={chrome}
                  label="Aufbau Küche"
                  hint={`${pricingConfig.kitchenAssemblyPricePerMeter} EUR / m`}
                  lightMode={lightMode}
                  onChange={(checked) => toggleKitchenOption("optionAssembly", checked)}
                  priceLabel={priceFormatter.format(kitchenAssemblyPrice)}
                />

                <TogglePriceRow
                  checked={wizardData.kitchen.optionRebuild}
                  chrome={chrome}
                  label="Neuaufbau Küche"
                  hint={`${pricingConfig.kitchenRebuildPricePerMeter} EUR / m`}
                  lightMode={lightMode}
                  onChange={(checked) => toggleKitchenOption("optionRebuild", checked)}
                  priceLabel={priceFormatter.format(kitchenRebuildPrice)}
                />

                <TogglePriceRow
                  checked={wizardData.kitchen.optionApplianceConnect}
                  chrome={chrome}
                  label="Anschluss E-Geräte"
                  hint={`${pricingConfig.applianceConnectionPricePerItem} EUR / Stk`}
                  lightMode={lightMode}
                  onChange={(checked) => toggleKitchenOption("optionApplianceConnect", checked)}
                  priceLabel={priceFormatter.format(kitchenApplianceConnectPrice)}
                />

                <TogglePriceRow
                  checked={wizardData.kitchen.optionCountertopCutting}
                  chrome={chrome}
                  label="Zuschneiden Arbeitsplatten"
                  hint={`${pricingConfig.countertopCuttingPricePerItem} EUR / Platte`}
                  lightMode={lightMode}
                  onChange={(checked) => toggleKitchenOption("optionCountertopCutting", checked)}
                  priceLabel={priceFormatter.format(kitchenCountertopCuttingPrice)}
                />
              </div>
            </article>
          </div>
        </section>
      );
    }

    if (currentStep.id === "summary") {
      const sectionRowClass = `flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ${
        lightMode ? "bg-zinc-50 ring-1 ring-zinc-200" : "bg-zinc-900 ring-1 ring-white/10"
      }`;
      const plannedDateLabel = (() => {
        const trimmed = wizardData.plannedDate.trim();
        if (!trimmed) {
          return "Noch offen";
        }
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
          return "Ungültig";
        }
        return parsed.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
      })();

      const routeSubtotal =
        routeCalculationData !== null
          ? routeCalculationData.pricing.distancePrice +
            routeCalculationData.pricing.walkingDistancePrice +
            routeCalculationData.pricing.accessPrice +
            routeCalculationData.pricing.noParkingZonePrice
          : 0;
      const furnitureSubtotal =
        routeCalculationData !== null
          ? routeCalculationData.pricing.furnitureVolumePrice +
            routeCalculationData.pricing.assemblyPrice +
            routeCalculationData.pricing.disassemblyPrice +
            routeCalculationData.pricing.disposalPrice
          : 0;

      return (
        <div className="grid gap-4">
          <section className={chrome.panel}>
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className={chrome.sectionTitle}>Seite 7: Zusammenfassung</h3>
                <p className={chrome.sectionText}>Alle Posten aus Route, Möbeln, Zusatzleistungen und Küche.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className={`${chrome.compactSurfaceMuted} text-sm`}>
                  Gesamt: {routeCalculationData ? priceFormatter.format(grandTotalPrice) : "Route fehlt (nur Zusatzleistungen sichtbar)"}
                </div>
	                <button
	                  type="button"
	                  onClick={() => void createMoveAndGenerateDocuments()}
	                  disabled={!routeCalculationData || isSavingMove || isGeneratingDocuments || isLoadingEditMove}
	                  className={chrome.actionButton}
	                  title={!routeCalculationData ? "Bitte zuerst Route berechnen (Auszug + Einzug vollständig)." : undefined}
	                >
	                  {isSavingMove || isGeneratingDocuments
	                    ? "Erstelle..."
	                    : editingMoveMeta
	                      ? "Änderungen speichern"
	                      : "Umzug anlegen"}
	                </button>
	              </div>
	            </div>

            {routeCalculationData ? null : (
              <div className={`mt-4 ${chrome.subtleInset} text-sm`}>
                Route ist noch nicht berechnet. Ergänze Auszugs- und Einzugsadresse vollständig, dann erscheint hier auch die Umzugssumme inklusive Strecke.
              </div>
            )}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className={`${chrome.subtleInset} grid gap-3`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className={chrome.statLabel}>Leistungsdatum</p>
                    <p className={`mt-1 text-sm ${chrome.mutedText}`}>
                      Umzugstermin für Angebot und Rechnung (Pflichtangabe). Wenn offen: später nachtragen.
                    </p>
                  </div>
                  <div className={chrome.neutralChip}>{plannedDateLabel}</div>
                </div>
                <FieldLabel label="Umzugstermin" lightMode={lightMode}>
                  <input
                    type="date"
                    value={wizardData.plannedDate}
                    onChange={(event) => updatePlannedDate(event.target.value)}
                    className={chrome.input}
                  />
                </FieldLabel>
              </div>

              <div className={`${chrome.subtleInset} grid gap-2 text-sm`}>
                <p className={chrome.statLabel}>Hinweis</p>
                <p className={chrome.mutedText}>
                  Angebot/Rechnung werden mit den aktuellen Firmendaten aus <span className="font-medium">Einstellungen → Firma</span> erstellt.
                  Bitte prüfe Umsatzsteuer-Status (Kleinunternehmer vs. MwSt.) und Zahlungsbedingungen, bevor du PDFs an Kunden versendest.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <article className={chrome.subtlePanel}>
                <h4 className={chrome.sectionTitle}>Route & Zugang</h4>
                <p className={chrome.sectionText}>Fahrstrecke, Laufmeter, Stockwerke, Halteverbotszone.</p>

                {routeCalculationData ? (
                  <div className="mt-4 grid gap-2">
                    <div className={sectionRowClass}>
                      <span>Fahrstrecke</span>
                      <span className="font-semibold">{priceFormatter.format(routeCalculationData.pricing.distancePrice)}</span>
                    </div>
                    <div className={sectionRowClass}>
                      <span>Laufweg</span>
                      <span className="font-semibold">{priceFormatter.format(routeCalculationData.pricing.walkingDistancePrice)}</span>
                    </div>
                    <div className={sectionRowClass}>
                      <span>Stockwerk/Access</span>
                      <span className="font-semibold">{priceFormatter.format(routeCalculationData.pricing.accessPrice)}</span>
                    </div>
                    <div className={sectionRowClass}>
                      <span>Halteverbotszone</span>
                      <span className="font-semibold">{priceFormatter.format(routeCalculationData.pricing.noParkingZonePrice)}</span>
                    </div>
                    <div className={`${sectionRowClass} font-semibold`}>
                      <span>Zwischensumme</span>
                      <span>{priceFormatter.format(routeSubtotal)}</span>
                    </div>
                  </div>
                ) : (
                  <div className={`mt-4 ${chrome.emptyState}`}>Noch keine Route berechnet.</div>
                )}
              </article>

              <article className={chrome.subtlePanel}>
                <h4 className={chrome.sectionTitle}>Möbel & Services</h4>
                <p className={chrome.sectionText}>Volumen, Aufbau/Abbau, Entsorgung.</p>

                {routeCalculationData ? (
                  <div className="mt-4 grid gap-2">
                    <div className={sectionRowClass}>
                      <span>Möbelvolumen</span>
                      <span className="font-semibold">{priceFormatter.format(routeCalculationData.pricing.furnitureVolumePrice)}</span>
                    </div>
                    <div className={sectionRowClass}>
                      <span>Aufbau</span>
                      <span className="font-semibold">{priceFormatter.format(routeCalculationData.pricing.assemblyPrice)}</span>
                    </div>
                    <div className={sectionRowClass}>
                      <span>Abbau</span>
                      <span className="font-semibold">{priceFormatter.format(routeCalculationData.pricing.disassemblyPrice)}</span>
                    </div>
                    <div className={sectionRowClass}>
                      <span>Entsorgung</span>
                      <span className="font-semibold">{priceFormatter.format(routeCalculationData.pricing.disposalPrice)}</span>
                    </div>
                    <div className={`${sectionRowClass} font-semibold`}>
                      <span>Zwischensumme</span>
                      <span>{priceFormatter.format(furnitureSubtotal)}</span>
                    </div>
                  </div>
                ) : (
                  <div className={`mt-4 ${chrome.emptyState}`}>Noch keine Möbel-/Volumenpreise berechnet.</div>
                )}
              </article>

              <article className={chrome.subtlePanel}>
                <h4 className={chrome.sectionTitle}>Zusatzleistungen Allgemein</h4>
                <p className={chrome.sectionText}>Handwerk und Verpackungsmaterial.</p>

                <div className="mt-4 grid gap-2">
                  <div className={sectionRowClass}>
                    <span>Handwerk</span>
                    <span className="font-semibold">{priceFormatter.format(handymanTotalPrice)}</span>
                  </div>
                  <div className={sectionRowClass}>
                    <span>Verpackungsmaterial</span>
                    <span className="font-semibold">{priceFormatter.format(packingTotalPrice)}</span>
                  </div>
                  <div className={`${sectionRowClass} font-semibold`}>
                    <span>Zwischensumme</span>
                    <span>{priceFormatter.format(extrasTotalPrice)}</span>
                  </div>
                </div>
              </article>

              {wizardData.roomSelections.includes("kitchen") ? (
                <article className={chrome.subtlePanel}>
                  <h4 className={chrome.sectionTitle}>Küchenleistungen</h4>
                  <p className={chrome.sectionText}>Abbau/Aufbau/Neuaufbau, Geräte, Arbeitsplatten.</p>

                  <div className="mt-4 grid gap-2">
                    <div className={sectionRowClass}>
                      <span>Küche gesamt</span>
                      <span className="font-semibold">{priceFormatter.format(kitchenTotalPrice)}</span>
                    </div>
                    <div className={`${sectionRowClass} font-semibold`}>
                      <span>Zwischensumme</span>
                      <span>{priceFormatter.format(kitchenTotalPrice)}</span>
                    </div>
                  </div>
                </article>
              ) : null}
            </div>

            <div className="mt-5">
              <div className={`rounded-2xl p-4 ${lightMode ? "bg-[#FF007F]/10 ring-1 ring-[#FF007F]/25" : "bg-[#FF007F]/15 ring-1 ring-[#FF007F]/35"}`}>
                <p className="text-xs uppercase tracking-[0.2em] text-[#FF007F]">Gesamtsumme</p>
                <p className={`mt-2 text-3xl font-semibold ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>
                  {routeCalculationData ? priceFormatter.format(grandTotalPrice) : priceFormatter.format(manualServicesTotalPrice)}
                </p>
                <p className={`mt-1 text-sm ${chrome.mutedText}`}>
                  {routeCalculationData
                    ? wizardData.roomSelections.includes("kitchen")
                      ? "Route + Möbel + Zusatzleistungen + Küche"
                      : "Route + Möbel + Zusatzleistungen"
                    : wizardData.roomSelections.includes("kitchen")
                      ? "Zusatzleistungen + Küche (Route fehlt noch)"
                      : "Zusatzleistungen (Route fehlt noch)"}
                </p>
              </div>
            </div>
          </section>
        </div>
      );
    }

    if (currentStep.id === "downloads") {
      return (
        <section className={chrome.panel}>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className={chrome.sectionTitle}>Dokumente bereit</h3>
              <p className={chrome.sectionText}>Angebot, Rechnung und Möbelcheckliste wurden erstellt und im Explorer abgelegt.</p>
            </div>
            <div className={`${chrome.compactSurfaceMuted} text-sm`}>
              {generatedDocuments.length > 0 ? `${generatedDocuments.length} PDFs` : "Noch keine PDFs"}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {generatedDocuments.length === 0 ? (
              <div className={`${chrome.emptyState} md:col-span-3`}>Es wurden noch keine PDFs erzeugt.</div>
            ) : (
              generatedDocuments.map((doc) => (
                <a
                  key={doc.relativePath}
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-2xl p-4 transition ${
                    lightMode
                      ? "bg-white ring-1 ring-zinc-200 hover:bg-zinc-50"
                      : "bg-zinc-900 ring-1 ring-white/10 hover:bg-zinc-800"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-[#FF007F]">PDF</p>
                  <p className={`mt-2 text-lg font-semibold ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>{doc.label}</p>
                  <p className={`mt-1 text-sm ${chrome.mutedText}`}>{doc.fileName}</p>
                  <p className={`mt-4 text-sm font-medium ${lightMode ? "text-zinc-800" : "text-zinc-200"}`}>Öffnen</p>
                </a>
              ))
            )}
          </div>
        </section>
      );
    }

    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-3 md:p-6">
      <button
        type="button"
        aria-label="Modal schließen"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={`relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-none sm:max-h-[96vh] sm:rounded-[2rem] ${
          lightMode ? "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-300" : "bg-zinc-950 text-zinc-100 ring-1 ring-white/10"
        }`}
      >
        <header className={`border-b px-4 py-4 sm:px-5 sm:py-5 md:px-6 ${lightMode ? "border-zinc-200" : "border-white/10"}`}>
		          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
		            <div>
		              <p className="text-xs uppercase tracking-[0.2em] text-[#FF007F]">{editingMoveMeta ? "Umzug bearbeiten" : "Umzug anlegen"}</p>
		              <h2 className="mt-2 text-2xl font-semibold">{editingMoveMeta ? editingMoveMeta.moveNumber : "Neuer Umzug"}</h2>
		              <p className={`mt-1 max-w-3xl text-sm ${chrome.mutedText}`}>
		                {currentStep.title} | Aufruf aus {sourceLabel}
		                {customerNumber ? ` | Kunde ${customerNumber}` : ""}
		              </p>
		            </div>

	            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-3">
	              <div className={chrome.heroAccentCard}>
	                <p className={chrome.heroAccentEyebrow}>Live-Preisanzeige</p>
	                <p className={chrome.heroAccentValue}>{livePriceLabel}</p>
	              </div>
	              <button type="button" onClick={onClose} className={chrome.secondaryButton}>
	                Schließen
	              </button>
	            </div>
	          </div>

	          <div className="mt-4 grid gap-3">
	            <div className="flex items-center justify-between gap-3 md:hidden">
	              <div className="min-w-0">
	                <p className={`text-[11px] uppercase tracking-[0.18em] ${chrome.overline}`}>
	                  Schritt {visibleStepIndex + 1} / {visibleWizardSteps.length}
	                </p>
	                <p className="mt-1 truncate text-sm font-semibold">{currentStep.title}</p>
	              </div>

	              <div className="relative shrink-0">
	                {stepMenuOpen ? (
	                  <button
	                    type="button"
	                    aria-label="Schritte schließen"
	                    className="fixed inset-0 z-10 cursor-default"
	                    onClick={() => setStepMenuOpen(false)}
	                  />
	                ) : null}

	                <button
	                  type="button"
	                  onClick={() => setStepMenuOpen((prev) => !prev)}
	                  className={`relative z-20 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
	                    lightMode
	                      ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
	                      : "border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
	                  }`}
	                  aria-haspopup="menu"
	                  aria-expanded={stepMenuOpen}
	                >
	                  Schritte
	                  <span className={chrome.overline}>{stepMenuOpen ? "▲" : "▼"}</span>
	                </button>

	                {stepMenuOpen ? (
	                  <div
	                    className={`absolute right-0 top-11 z-30 w-[260px] rounded-xl border p-2 ${
	                      lightMode
	                        ? "border-zinc-200 bg-white shadow-xl shadow-zinc-900/10"
	                        : "border-white/10 bg-zinc-950 shadow-xl shadow-black/40"
	                    }`}
	                    role="menu"
	                  >
	                    <p className={`px-3 py-2 text-xs ${chrome.overline}`}>Schritte</p>
	                    {visibleWizardSteps.map((step, visibleIndex) => {
	                      const stepIndex = wizardSteps.findIndex((candidate) => candidate.id === step.id);
	                      const isActive = step.id === currentStep.id;
	                      const isCompleted = stepIndex >= 0 && currentStepIndex >= 0 ? stepIndex < currentStepIndex : false;

	                      return (
	                        <button
	                          key={step.id}
	                          type="button"
	                          onClick={() => {
	                            setCurrentStepId(step.id);
	                            setStepMenuOpen(false);
	                          }}
	                          className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-sm transition ${
	                            isActive
	                              ? "bg-[#FF007F] text-white"
	                              : lightMode
	                                ? "text-zinc-900 hover:bg-zinc-100"
	                                : "text-zinc-100 hover:bg-white/10"
	                          }`}
	                          role="menuitem"
	                        >
	                          <span className="min-w-0 truncate">
	                            {visibleIndex + 1}. {step.title}
	                          </span>
	                          <span className={`shrink-0 text-xs ${isActive ? "text-white/80" : isCompleted ? "text-[#FF007F]" : chrome.overline}`}>
	                            {isActive ? "Aktiv" : isCompleted ? "OK" : ""}
	                          </span>
	                        </button>
	                      );
	                    })}
	                  </div>
	                ) : null}
	              </div>
	            </div>

	            <div className={`h-2 overflow-hidden rounded-full ${lightMode ? "bg-zinc-200" : "bg-white/10"} md:hidden`}>
	              <div className="h-full rounded-full bg-[#FF007F]" style={{ width: `${stepProgressPercent}%` }} />
	            </div>

	            <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] xl:hidden">
	              {visibleWizardSteps.map((step, visibleIndex) => {
	                const stepIndex = wizardSteps.findIndex((candidate) => candidate.id === step.id);
	                const isActive = step.id === currentStep.id;
	                const isCompleted = stepIndex >= 0 && currentStepIndex >= 0 ? stepIndex < currentStepIndex : false;

	                return (
	                  <button
	                    key={step.id}
	                    type="button"
	                    onClick={() => setCurrentStepId(step.id)}
	                    className={`shrink-0 rounded-full px-3 py-2 text-sm transition ${
	                      isActive
	                        ? "bg-[#FF007F] text-white shadow-lg shadow-[#FF007F]/20"
	                        : isCompleted
	                          ? lightMode
	                            ? "bg-[#FF007F]/10 text-zinc-900 ring-1 ring-[#FF007F]/20"
	                            : "bg-[#FF007F]/12 text-zinc-100 ring-1 ring-[#FF007F]/25"
	                          : lightMode
	                            ? "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
	                            : "bg-zinc-900 text-zinc-300 ring-1 ring-white/10 hover:bg-zinc-800"
	                    }`}
	                  >
	                    {visibleIndex + 1}. {step.title}
	                  </button>
	                );
	              })}
	            </div>

	            <div
	              className="hidden xl:grid xl:grid-cols-2 xl:gap-2 xl:[grid-template-columns:repeat(var(--wizard-steps),minmax(0,1fr))]"
	              style={{ ["--wizard-steps" as never]: visibleWizardSteps.length }}
	            >
	              {visibleWizardSteps.map((step, visibleIndex) => {
	                const stepIndex = wizardSteps.findIndex((candidate) => candidate.id === step.id);
	                const isActive = step.id === currentStep.id;
	                const isCompleted = stepIndex >= 0 && currentStepIndex >= 0 ? stepIndex < currentStepIndex : false;

	                return (
	                  <button
	                    key={step.id}
	                    type="button"
	                    onClick={() => setCurrentStepId(step.id)}
	                    className={`rounded-2xl px-3 py-3 text-left transition ${
	                      isActive
	                        ? "bg-[#FF007F] text-white shadow-lg shadow-[#FF007F]/20"
	                        : isCompleted
	                          ? lightMode
	                            ? "bg-[#FF007F]/10 text-zinc-900 ring-1 ring-[#FF007F]/20"
	                            : "bg-[#FF007F]/12 text-zinc-100 ring-1 ring-[#FF007F]/25"
	                          : lightMode
	                            ? "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50"
	                            : "bg-zinc-900 text-zinc-300 ring-1 ring-white/10 hover:bg-zinc-800"
	                    }`}
	                  >
	                    <p className={`text-[11px] uppercase tracking-[0.16em] ${isActive ? "text-white/75" : "text-[#FF007F]"}`}>
	                      Seite {visibleIndex + 1}
	                    </p>
	                    <p className="mt-1 text-sm font-medium">{step.title}</p>
	                  </button>
	                );
	              })}
	            </div>
	          </div>
	        </header>

	        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 md:px-6">
	          {renderCurrentStep()}
	        </div>

	        <footer className={`flex flex-col gap-3 border-t px-4 py-3 sm:px-5 sm:py-4 md:flex-row md:items-center md:justify-between md:px-6 ${lightMode ? "border-zinc-200" : "border-white/10"}`}>
	          <div className={`${chrome.compactSurfaceMuted} text-sm`}>
	            {currentStep.id === "rooms"
	              ? `${selectedRoomCount} Räume aktuell markiert`
	              : currentStep.id === "addresses"
                ? routeCalculationData
                  ? `${routeDistanceLabel} | ${livePriceLabel} live kalkuliert`
                  : `${wizardData.stopAddresses.length} Zwischenstopps angelegt`
                : currentStep.id === "furniture"
                  ? `${wizardData.furnitureSelections.length} Möbelkarten aktuell im Formular`
                  : currentStep.id === "extras"
                    ? `Zusatzleistungen: ${priceFormatter.format(extrasTotalPrice)}`
                    : currentStep.id === "kitchen"
                      ? `Küche: ${priceFormatter.format(kitchenTotalPrice)}`
                      : currentStep.id === "summary"
                        ? routeCalculationData
                          ? `Gesamt: ${priceFormatter.format(grandTotalPrice)}`
                          : `Zusatz: ${priceFormatter.format(manualServicesTotalPrice)} (Route fehlt)`
                        : currentStep.id === "downloads"
                          ? "PDFs erstellt und abgelegt"
                        : "Daten werden vorbereitet."}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className={chrome.secondaryButton}>
              Abbrechen
            </button>
            <button type="button" onClick={goToPreviousStep} disabled={currentStepIndex <= 0} className={chrome.secondaryButton}>
              Zurück
            </button>
            <button
              type="button"
              onClick={
                currentStep.id === "downloads"
                  ? onClose
                  : currentStep.id === "summary"
                    ? () => void createMoveAndGenerateDocuments()
                    : goToNextStep
              }
	              disabled={isSavingMove || isGeneratingDocuments || isLoadingEditMove}
	              className={chrome.actionButton}
	            >
	              {currentStep.id === "downloads"
	                ? "Fertig"
	                : currentStep.id === "summary"
	                  ? isSavingMove || isGeneratingDocuments
	                    ? "Erstelle..."
	                    : editingMoveMeta
	                      ? "Änderungen speichern"
	                      : "Umzug anlegen"
	                  : "Weiter"}
	            </button>
          </div>
        </footer>
        {saveErrorMessage ? (
          <div className={`border-t px-5 py-3 text-sm ${lightMode ? "border-zinc-200 bg-red-50 text-red-700" : "border-white/10 bg-red-950/40 text-red-200"}`}>
            {saveErrorMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function useMoveWizard() {
  const context = useContext(MoveWizardContext);

  if (!context) {
    throw new Error("useMoveWizard must be used within MoveWizardProvider.");
  }

  return context;
}

export function MoveWizardProvider({ children, lightMode }: MoveWizardProviderProps) {
  const [session, setSession] = useState<MoveWizardSession | null>(null);

  const contextValue = useMemo<MoveWizardContextValue>(
    () => ({
      openMoveWizard(options) {
        setSession({
          id: Date.now(),
          options,
        });
      },
    }),
    [],
  );

  return (
    <MoveWizardContext.Provider value={contextValue}>
      {children}
      {session ? <MoveWizardModal key={session.id} lightMode={lightMode} onClose={() => setSession(null)} options={session.options} /> : null}
    </MoveWizardContext.Provider>
  );
}
