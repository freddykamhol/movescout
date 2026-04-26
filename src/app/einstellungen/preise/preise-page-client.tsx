"use client";

import { useMemo, useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";
import SettingsTabs from "@/app/_components/settings-tabs";
import {
  defaultMovePricingConfig,
  movePricingFields,
  movePricingSections,
  type MovePricingConfig,
  type MovePricingFieldKey,
} from "@/lib/move-pricing";

type PreisePageClientProps = {
  furnitureCategoryGroups: Array<{
    id: string;
    items: string[];
    label: string;
  }>;
  initialPricingConfig: MovePricingConfig;
};

type PricingFormState = Record<MovePricingFieldKey, string>;

const priceFormatter = new Intl.NumberFormat("de-DE", {
  currency: "EUR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function createPricingFormState(config: MovePricingConfig): PricingFormState {
  return {
    assemblyPricePerItem: String(config.assemblyPricePerItem),
    applianceConnectionPricePerItem: String(config.applianceConnectionPricePerItem),
    bookBoxPrice: String(config.bookBoxPrice),
    bubbleWrapSheetPrice: String(config.bubbleWrapSheetPrice),
    ceilingHeightSurcharge: String(config.ceilingHeightSurcharge),
    ceilingLampInstallPricePerItem: String(config.ceilingLampInstallPricePerItem),
    countertopCuttingPricePerItem: String(config.countertopCuttingPricePerItem),
    curtainRodHolePricePerItem: String(config.curtainRodHolePricePerItem),
    disassemblyPricePerItem: String(config.disassemblyPricePerItem),
    disposalPricePerCubicMeter: String(config.disposalPricePerCubicMeter),
    elevatorFlatFee: String(config.elevatorFlatFee),
    freeWalkingDistanceMeters: String(config.freeWalkingDistanceMeters),
    floorPricePerLevel: String(config.floorPricePerLevel),
    furnitureCubicMeterDecimalPrice: String(config.furnitureCubicMeterDecimalPrice),
    furnitureCubicMeterFullPrice: String(config.furnitureCubicMeterFullPrice),
    kitchenAssemblyPricePerMeter: String(config.kitchenAssemblyPricePerMeter),
    kitchenDisassemblyPricePerMeter: String(config.kitchenDisassemblyPricePerMeter),
    kitchenRebuildPricePerMeter: String(config.kitchenRebuildPricePerMeter),
    noParkingZoneFlatFee: String(config.noParkingZoneFlatFee),
    movingBoxPrice: String(config.movingBoxPrice),
    packingPackPricePerItem: String(config.packingPackPricePerItem),
    packingUnpackPricePerItem: String(config.packingUnpackPricePerItem),
    pricePerKilometer: String(config.pricePerKilometer),
    stretchFilmPricePerMeter: String(config.stretchFilmPricePerMeter),
    wardrobeBoxPrice: String(config.wardrobeBoxPrice),
    walkingDistanceStepMeters: String(config.walkingDistanceStepMeters),
    walkingDistanceStepPrice: String(config.walkingDistanceStepPrice),
  };
}

function parseFormNumber(value: string, fallbackValue: number) {
  const normalizedValue = value.trim().replace(",", ".");

  if (!normalizedValue) {
    return fallbackValue;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : fallbackValue;
}

function normalizePricingFormState(formState: PricingFormState) {
  return {
    assemblyPricePerItem: parseFormNumber(formState.assemblyPricePerItem, defaultMovePricingConfig.assemblyPricePerItem),
    applianceConnectionPricePerItem: parseFormNumber(
      formState.applianceConnectionPricePerItem,
      defaultMovePricingConfig.applianceConnectionPricePerItem,
    ),
    bookBoxPrice: parseFormNumber(formState.bookBoxPrice, defaultMovePricingConfig.bookBoxPrice),
    bubbleWrapSheetPrice: parseFormNumber(formState.bubbleWrapSheetPrice, defaultMovePricingConfig.bubbleWrapSheetPrice),
    ceilingHeightSurcharge: parseFormNumber(formState.ceilingHeightSurcharge, defaultMovePricingConfig.ceilingHeightSurcharge),
    ceilingLampInstallPricePerItem: parseFormNumber(
      formState.ceilingLampInstallPricePerItem,
      defaultMovePricingConfig.ceilingLampInstallPricePerItem,
    ),
    countertopCuttingPricePerItem: parseFormNumber(
      formState.countertopCuttingPricePerItem,
      defaultMovePricingConfig.countertopCuttingPricePerItem,
    ),
    curtainRodHolePricePerItem: parseFormNumber(
      formState.curtainRodHolePricePerItem,
      defaultMovePricingConfig.curtainRodHolePricePerItem,
    ),
    disassemblyPricePerItem: parseFormNumber(formState.disassemblyPricePerItem, defaultMovePricingConfig.disassemblyPricePerItem),
    disposalPricePerCubicMeter: parseFormNumber(
      formState.disposalPricePerCubicMeter,
      defaultMovePricingConfig.disposalPricePerCubicMeter,
    ),
    elevatorFlatFee: parseFormNumber(formState.elevatorFlatFee, defaultMovePricingConfig.elevatorFlatFee),
    freeWalkingDistanceMeters: parseFormNumber(
      formState.freeWalkingDistanceMeters,
      defaultMovePricingConfig.freeWalkingDistanceMeters,
    ),
    floorPricePerLevel: parseFormNumber(formState.floorPricePerLevel, defaultMovePricingConfig.floorPricePerLevel),
    furnitureCubicMeterDecimalPrice: parseFormNumber(
      formState.furnitureCubicMeterDecimalPrice,
      defaultMovePricingConfig.furnitureCubicMeterDecimalPrice,
    ),
    furnitureCubicMeterFullPrice: parseFormNumber(
      formState.furnitureCubicMeterFullPrice,
      defaultMovePricingConfig.furnitureCubicMeterFullPrice,
    ),
    kitchenAssemblyPricePerMeter: parseFormNumber(
      formState.kitchenAssemblyPricePerMeter,
      defaultMovePricingConfig.kitchenAssemblyPricePerMeter,
    ),
    kitchenDisassemblyPricePerMeter: parseFormNumber(
      formState.kitchenDisassemblyPricePerMeter,
      defaultMovePricingConfig.kitchenDisassemblyPricePerMeter,
    ),
    kitchenRebuildPricePerMeter: parseFormNumber(
      formState.kitchenRebuildPricePerMeter,
      defaultMovePricingConfig.kitchenRebuildPricePerMeter,
    ),
    noParkingZoneFlatFee: parseFormNumber(formState.noParkingZoneFlatFee, defaultMovePricingConfig.noParkingZoneFlatFee),
    movingBoxPrice: parseFormNumber(formState.movingBoxPrice, defaultMovePricingConfig.movingBoxPrice),
    packingPackPricePerItem: parseFormNumber(formState.packingPackPricePerItem, defaultMovePricingConfig.packingPackPricePerItem),
    packingUnpackPricePerItem: parseFormNumber(
      formState.packingUnpackPricePerItem,
      defaultMovePricingConfig.packingUnpackPricePerItem,
    ),
    pricePerKilometer: parseFormNumber(formState.pricePerKilometer, defaultMovePricingConfig.pricePerKilometer),
    stretchFilmPricePerMeter: parseFormNumber(formState.stretchFilmPricePerMeter, defaultMovePricingConfig.stretchFilmPricePerMeter),
    wardrobeBoxPrice: parseFormNumber(formState.wardrobeBoxPrice, defaultMovePricingConfig.wardrobeBoxPrice),
    walkingDistanceStepMeters: parseFormNumber(
      formState.walkingDistanceStepMeters,
      defaultMovePricingConfig.walkingDistanceStepMeters,
    ),
    walkingDistanceStepPrice: parseFormNumber(
      formState.walkingDistanceStepPrice,
      defaultMovePricingConfig.walkingDistanceStepPrice,
    ),
  } satisfies MovePricingConfig;
}

export default function PreisePageClient({
  furnitureCategoryGroups,
  initialPricingConfig,
}: PreisePageClientProps) {
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);
  const [formState, setFormState] = useState(() => createPricingFormState(initialPricingConfig));
  const [savedConfig, setSavedConfig] = useState(initialPricingConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Preise können hier zentral gepflegt und direkt gespeichert werden.");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const normalizedFormState = useMemo(() => normalizePricingFormState(formState), [formState]);
  const hasUnsavedChanges = JSON.stringify(normalizedFormState) !== JSON.stringify(savedConfig);
  const categoryItemCount = furnitureCategoryGroups.reduce((sum, categoryGroup) => sum + categoryGroup.items.length, 0);

  function updateField(field: MovePricingFieldKey, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function resetToDefaults() {
    setFormState(createPricingFormState(defaultMovePricingConfig));
    setStatusMessage("Standardwerte geladen. Mit Speichern werden sie dauerhaft übernommen.");
  }

  async function savePricingConfig() {
    setIsSaving(true);
    setStatusMessage("Preise werden gespeichert...");

    try {
      const response = await fetch("/api/settings/pricing", {
        body: JSON.stringify(normalizedFormState),
        headers: {
          "content-type": "application/json",
        },
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("Die Preise konnten nicht gespeichert werden.");
      }

      const payload = (await response.json()) as {
        message?: string;
        pricingConfig: MovePricingConfig;
        savedAt?: string;
      };

      setFormState(createPricingFormState(payload.pricingConfig));
      setSavedConfig(payload.pricingConfig);
      setStatusMessage(payload.message ?? "Preise wurden gespeichert.");
      setLastSavedAt(payload.savedAt ?? new Date().toISOString());
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Die Preise konnten nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Einstellungen</p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className={chrome.heroTitle}>Preise und Kalkulation</h1>
            <p className={chrome.heroText}>
              Hier pflegst du alle Preisbausteine für Strecke, Zugang, Möbelvolumen und Zusatzleistungen an einer
              Stelle.
            </p>
          </div>
          <div className={chrome.heroAccentCard}>
            <p className={chrome.heroAccentEyebrow}>Aktiver Kilometerpreis</p>
            <p className={chrome.heroAccentValue}>{priceFormatter.format(normalizedFormState.pricePerKilometer)}</p>
            <p className={chrome.heroAccentMeta}>pro gefahrenem Kilometer</p>
          </div>
        </div>
        <SettingsTabs lightMode={lightMode} />
      </header>

      <div className={chrome.statsGrid}>
        <article className={chrome.statAccentCard}>
          <p className={chrome.statLabel}>Preisfelder</p>
          <p className={chrome.statAccentValue}>{Object.keys(movePricingFields).length}</p>
          <p className={chrome.statHint}>zentral konfigurierbar</p>
        </article>
        <article className={chrome.statCard}>
          <p className={chrome.statLabel}>Kategorien</p>
          <p className={chrome.statValue}>{furnitureCategoryGroups.length}</p>
          <p className={chrome.statHint}>aktive Möbelgruppen</p>
        </article>
        <article className={chrome.statCard}>
          <p className={chrome.statLabel}>Aufbau / Abbau</p>
          <p className={chrome.statValue}>
            {priceFormatter.format(normalizedFormState.assemblyPricePerItem)} / {priceFormatter.format(normalizedFormState.disassemblyPricePerItem)}
          </p>
          <p className={chrome.statHint}>pro Möbelstück</p>
        </article>
        <article className={chrome.statCard}>
          <p className={chrome.statLabel}>Möbel im Katalog</p>
          <p className={chrome.statValue}>{categoryItemCount}</p>
          <p className={chrome.statHint}>bereits kategorisiert</p>
        </article>
      </div>

      <section className={chrome.panel}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className={chrome.sectionTitle}>Preisregeln</h2>
            <p className={chrome.sectionText}>
              Änderungen werden in der zentralen Konfiguration gespeichert und für neue Preisberechnungen übernommen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={resetToDefaults} className={chrome.secondaryButton}>
              Standardwerte laden
            </button>
            <button type="button" onClick={() => void savePricingConfig()} disabled={isSaving} className={chrome.actionButton}>
              {isSaving ? "Speichert..." : "Änderungen speichern"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className={`${chrome.subtleInset} text-sm`}>{statusMessage}</div>
          <div className={`${chrome.subtleInset} text-sm`}>
            {lastSavedAt
              ? `Zuletzt gespeichert: ${dateTimeFormatter.format(new Date(lastSavedAt))}`
              : hasUnsavedChanges
                ? "Ungespeicherte Änderungen vorhanden."
                : "Alle Werte entsprechen dem gespeicherten Stand."}
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          {movePricingSections.map((section) => (
            <article key={section.id} className={chrome.subtlePanel}>
              <div>
                <h3 className={chrome.sectionTitle}>{section.title}</h3>
                <p className={chrome.sectionText}>{section.description}</p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {section.fields.map((field) => {
                  const fieldDefinition = movePricingFields[field];

                  return (
                    <label key={field} className="grid gap-2 text-sm">
                      <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>{fieldDefinition.label}</span>
                      <span className={chrome.mutedText}>{fieldDefinition.description}</span>
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px]">
                        <input
                          type="number"
                          min="0"
                          step={fieldDefinition.step}
                          inputMode="decimal"
                          value={formState[field]}
                          onChange={(event) => updateField(field, event.target.value)}
                          className={chrome.input}
                        />
                        <div className={`${chrome.compactSurfaceMuted} flex items-center justify-center text-xs uppercase tracking-[0.14em]`}>
                          {fieldDefinition.unit}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={chrome.panel}>
        <div>
          <h2 className={chrome.sectionTitle}>Möbelkategorien</h2>
          <p className={chrome.sectionText}>
            Die vorhandenen Möbel sind jetzt kategorisiert, damit Auswahl und Pflege im Umzugsformular klarer werden.
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {furnitureCategoryGroups.map((categoryGroup) => (
            <article key={categoryGroup.id} className={chrome.subtlePanel}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className={`text-base font-semibold ${chrome.bodyText}`}>{categoryGroup.label}</h3>
                  <p className={`mt-1 text-sm ${chrome.mutedText}`}>{categoryGroup.items.length} Möbel im Katalog</p>
                </div>
                <span className={chrome.chip}>{categoryGroup.items.length}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {categoryGroup.items.map((item) => (
                  <span key={`${categoryGroup.id}-${item}`} className={chrome.neutralChip}>
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
