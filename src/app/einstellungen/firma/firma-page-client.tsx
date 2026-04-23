"use client";

import type { Organization } from "@/generated/prisma/client";
import Image from "next/image";
import { useMemo, useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";

type FirmaPageClientProps = {
  initialOrganization: Organization | null;
};

type CompanyFormState = {
  bankName: string;
  bic: string;
  city: string;
  country: string;
  email: string;
  isSmallBusiness: boolean;
  iban: string;
  legalName: string;
  name: string;
  phone: string;
  postalCode: string;
  street: string;
  vatId: string;
  taxNumber: string;
  vatRatePercent: string;
  website: string;
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

function createFormState(organization: Organization | null): CompanyFormState {
  return {
    name: organization?.name ?? "",
    legalName: organization?.legalName ?? "",
    vatId: organization?.vatId ?? "",
    taxNumber: organization?.taxNumber ?? "",
    isSmallBusiness: organization?.isSmallBusiness ?? false,
    vatRatePercent: String(organization?.vatRatePercent ?? 19),
    street: organization?.street ?? "",
    postalCode: organization?.postalCode ?? "",
    city: organization?.city ?? "",
    country: organization?.country ?? "",
    phone: organization?.phone ?? "",
    email: organization?.email ?? "",
    website: organization?.website ?? "",
    bankName: organization?.bankName ?? "",
    iban: organization?.iban ?? "",
    bic: organization?.bic ?? "",
  };
}

export default function FirmaPageClient({ initialOrganization }: FirmaPageClientProps) {
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);
  const [organization, setOrganization] = useState<Organization | null>(initialOrganization);
  const [logoUrl, setLogoUrl] = useState<string | null>(() =>
    initialOrganization?.logoPath ? `/api/documents/file?path=${encodeURIComponent(initialOrganization.logoPath)}` : null,
  );
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [logoStatusMessage, setLogoStatusMessage] = useState("");
  const [formState, setFormState] = useState<CompanyFormState>(() => createFormState(initialOrganization));
  const [savedState, setSavedState] = useState(() => createFormState(initialOrganization));
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Hier pflegst du alle Firmendaten deiner Organisation. Die Werte werden direkt in der Datenbank gespeichert.",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(savedState),
    [formState, savedState],
  );

function updateField(field: keyof CompanyFormState, value: string) {
  setFormState((currentState) => ({
    ...currentState,
    [field]: value,
  }));
}

function updateBooleanField(field: keyof Pick<CompanyFormState, "isSmallBusiness">, value: boolean) {
  setFormState((currentState) => ({
    ...currentState,
    [field]: value,
  }));
}

  async function saveCompanyData() {
    setIsSaving(true);
    setStatusMessage("Firmendaten werden gespeichert...");

    try {
      const vatRatePercent = Number(formState.vatRatePercent);
      const requestPayload = {
        ...formState,
        vatRatePercent: Number.isFinite(vatRatePercent) ? vatRatePercent : undefined,
      };

      const response = await fetch("/api/settings/company", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      const payload =
        (await readJsonResponse<{
          message?: string;
          organization?: Organization;
          savedAt?: string;
        }>(response)) ?? {};

      if (!response.ok || !payload.organization) {
        throw new Error(payload.message ?? "Firmendaten konnten nicht gespeichert werden.");
      }

      setOrganization(payload.organization);
      const nextState = createFormState(payload.organization);
      setFormState(nextState);
      setSavedState(nextState);
      setStatusMessage(payload.message ?? "Firmendaten wurden gespeichert.");
      setLastSavedAt(payload.savedAt ?? new Date().toISOString());
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Firmendaten konnten nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadLogo(file: File | null) {
    if (!file) {
      return;
    }

    setIsLogoUploading(true);
    setLogoStatusMessage("Logo wird hochgeladen...");

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/settings/company/logo", {
        method: "POST",
        body: formData,
      });
      const payload =
        (await readJsonResponse<{ message?: string; organization?: Organization; logoUrl?: string | null }>(response)) ??
        {};

      if (!response.ok || !payload.organization) {
        throw new Error(payload.message ?? "Logo konnte nicht gespeichert werden.");
      }

      setOrganization(payload.organization);
      setLogoUrl(payload.logoUrl ?? null);
      setLogoStatusMessage(payload.message ?? "Logo wurde gespeichert.");
    } catch (error) {
      setLogoStatusMessage(error instanceof Error ? error.message : "Logo konnte nicht gespeichert werden.");
    } finally {
      setIsLogoUploading(false);
    }
  }

  async function removeLogo() {
    setIsLogoUploading(true);
    setLogoStatusMessage("Logo wird entfernt...");

    try {
      const response = await fetch("/api/settings/company/logo", { method: "DELETE" });
      const payload =
        (await readJsonResponse<{ message?: string; organization?: Organization; logoUrl?: string | null }>(response)) ??
        {};

      if (!response.ok || !payload.organization) {
        throw new Error(payload.message ?? "Logo konnte nicht entfernt werden.");
      }

      setOrganization(payload.organization);
      setLogoUrl(null);
      setLogoStatusMessage(payload.message ?? "Logo wurde entfernt.");
    } catch (error) {
      setLogoStatusMessage(error instanceof Error ? error.message : "Logo konnte nicht entfernt werden.");
    } finally {
      setIsLogoUploading(false);
    }
  }

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Einstellungen</p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className={chrome.heroTitle}>Firmendaten</h1>
            <p className={chrome.heroText}>Organisation, Kontaktdaten und Abrechnungsinformationen zentral pflegen.</p>
          </div>
          <div className={chrome.heroAccentCard}>
            <p className={chrome.heroAccentEyebrow}>OrgKey</p>
            <p className={chrome.heroAccentValue}>{organization?.orgKey ?? "org_default"}</p>
            <p className={chrome.heroAccentMeta}>Datenzugriff wird daran geknüpft</p>
          </div>
        </div>
      </header>

      <section className={chrome.panel}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className={chrome.sectionTitle}>Organisation</h2>
            <p className={chrome.sectionText}>Diese Informationen werden für Angebote, Rechnungen und Dokumente genutzt.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFormState(savedState)} className={chrome.secondaryButton} disabled={!hasUnsavedChanges || isSaving}>
              Zurücksetzen
            </button>
            <button type="button" onClick={() => void saveCompanyData()} className={chrome.actionButton} disabled={isSaving || !hasUnsavedChanges}>
              {isSaving ? "Speichert..." : "Speichern"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className={`${chrome.subtleInset} text-sm`}>{statusMessage}</div>
          <div className={`${chrome.subtleInset} text-sm`}>
            {lastSavedAt ? `Zuletzt gespeichert: ${new Date(lastSavedAt).toLocaleString("de-DE")}` : hasUnsavedChanges ? "Ungespeicherte Änderungen vorhanden." : "Alle Werte sind gespeichert."}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <article className={chrome.subtlePanel}>
            <h3 className={chrome.sectionTitle}>Basis</h3>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Anzeigename</span>
                <input value={formState.name} onChange={(event) => updateField("name", event.target.value)} className={chrome.input} placeholder="z.B. MoveScout GmbH" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Rechtsname</span>
                <input value={formState.legalName} onChange={(event) => updateField("legalName", event.target.value)} className={chrome.input} placeholder="z.B. MoveScout GmbH" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>USt-IdNr.</span>
                <input value={formState.vatId} onChange={(event) => updateField("vatId", event.target.value)} className={chrome.input} placeholder="DE..." />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Steuernummer</span>
                <input value={formState.taxNumber} onChange={(event) => updateField("taxNumber", event.target.value)} className={chrome.input} placeholder="z.B. 12/345/67890" />
              </label>

              <div className={`${chrome.subtleInset} grid gap-3`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={chrome.statLabel}>Logo</p>
                    <p className={`mt-1 text-sm ${chrome.mutedText}`}>Wird in Angebot/Rechnung im Dokumentkopf angezeigt.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <label className={chrome.secondaryButton}>
                      {isLogoUploading ? "Lädt..." : "Logo hochladen"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        disabled={isLogoUploading}
                        onChange={(event) => void uploadLogo(event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <button type="button" className={chrome.secondaryButton} disabled={!logoUrl || isLogoUploading} onClick={() => void removeLogo()}>
                      Entfernen
                    </button>
                  </div>
                </div>
                {logoUrl ? (
                  <div className={`grid gap-2 rounded-xl p-3 ${lightMode ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-950 ring-1 ring-white/10"}`}>
                    <Image src={logoUrl} alt="Firmenlogo" width={180} height={56} className="h-12 w-auto object-contain" unoptimized />
                    <p className={`text-xs ${chrome.mutedText}`}>PNG/JPEG, max. 1 MB.</p>
                  </div>
                ) : (
                  <p className={`text-sm ${chrome.mutedText}`}>Noch kein Logo hochgeladen.</p>
                )}
                {logoStatusMessage ? <p className={`text-sm ${chrome.mutedText}`}>{logoStatusMessage}</p> : null}
              </div>
              <div className="grid gap-3 rounded-2xl p-4 ring-1 ring-zinc-200/80 bg-white/50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-semibold ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>Umsatzsteuer</p>
                    <p className={`mt-1 text-sm ${lightMode ? "text-zinc-600" : "text-zinc-300"}`}>
                      Für Angebot/Rechnung: Kleinunternehmer (kein USt-Ausweis) oder regulär mit Steuersatz.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formState.isSmallBusiness}
                      onChange={(event) => updateBooleanField("isSmallBusiness", event.target.checked)}
                      className="h-4 w-4 accent-[#FF007F]"
                    />
                    Kleinunternehmer (§19)
                  </label>
                </div>
                <label className="grid gap-2 text-sm">
                  <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>MwSt.-Satz (%)</span>
                  <input
                    value={formState.vatRatePercent}
                    onChange={(event) => updateField("vatRatePercent", event.target.value)}
                    className={chrome.input}
                    inputMode="numeric"
                    placeholder="19"
                    disabled={formState.isSmallBusiness}
                  />
                </label>
              </div>
            </div>
          </article>

          <article className={chrome.subtlePanel}>
            <h3 className={chrome.sectionTitle}>Kontakt</h3>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Telefon</span>
                <input value={formState.phone} onChange={(event) => updateField("phone", event.target.value)} className={chrome.input} placeholder="+49 ..." />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>E-Mail</span>
                <input value={formState.email} onChange={(event) => updateField("email", event.target.value)} className={chrome.input} placeholder="info@..." />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Webseite</span>
                <input value={formState.website} onChange={(event) => updateField("website", event.target.value)} className={chrome.input} placeholder="https://..." />
              </label>
            </div>
          </article>

          <article className={chrome.subtlePanel}>
            <h3 className={chrome.sectionTitle}>Adresse</h3>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Straße</span>
                <input value={formState.street} onChange={(event) => updateField("street", event.target.value)} className={chrome.input} placeholder="Musterstraße 1" />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>PLZ</span>
                  <input value={formState.postalCode} onChange={(event) => updateField("postalCode", event.target.value)} className={chrome.input} placeholder="12345" />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Stadt</span>
                  <input value={formState.city} onChange={(event) => updateField("city", event.target.value)} className={chrome.input} placeholder="Berlin" />
                </label>
              </div>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Land</span>
                <input value={formState.country} onChange={(event) => updateField("country", event.target.value)} className={chrome.input} placeholder="Deutschland" />
              </label>
            </div>
          </article>

          <article className={chrome.subtlePanel}>
            <h3 className={chrome.sectionTitle}>Bank</h3>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Bankname</span>
                <input value={formState.bankName} onChange={(event) => updateField("bankName", event.target.value)} className={chrome.input} placeholder="Bank" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>IBAN</span>
                <input value={formState.iban} onChange={(event) => updateField("iban", event.target.value)} className={chrome.input} placeholder="DE..." />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>BIC</span>
                <input value={formState.bic} onChange={(event) => updateField("bic", event.target.value)} className={chrome.input} placeholder="..." />
              </label>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
