"use client";

import { useRouter } from "next/navigation";
import { memo, useDeferredValue, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { useMoveWizard } from "@/app/_components/move-wizard";
import { getPageChrome } from "@/app/_components/page-styles";
import type { CustomerDocumentRecord, CustomerTableRecord } from "@/lib/customer-data";

type CustomerEditorMode = "edit" | "new" | null;
type MoveFilter = "all" | "one" | "repeat" | "heavy";

type StatCardProps = {
  accent?: boolean;
  hint: string;
  label: string;
  lightMode: boolean;
  value: number | string;
};

type EditorFieldProps = {
  children: ReactNode;
  label: string;
  lightMode: boolean;
};

type CustomerListItemProps = {
  customer: CustomerTableRecord;
  isSelected: boolean;
  lightMode: boolean;
  onSelectCustomer: (customer: CustomerTableRecord) => void;
};

type CustomerListPanelProps = {
  activeSelectedCustomerId: string | null;
  appliedFiltersAreActive: boolean;
  filteredCustomers: CustomerTableRecord[];
  lightMode: boolean;
  onSelectCustomer: (customer: CustomerTableRecord) => void;
};

type CustomerDetailsPanelProps = {
  lightMode: boolean;
  onBeginEditCustomer: () => void;
  onDeleteSelectedCustomer: () => void;
  selectedCustomer: CustomerTableRecord | null;
};

type CustomerEditorPanelProps = {
  editorDraft: CustomerTableRecord;
  editorMode: CustomerEditorMode;
  lightMode: boolean;
  onCancelEditing: () => void;
  onSaveCustomer: () => void;
  onUpdateDraft: (field: keyof CustomerTableRecord, value: CustomerTableRecord[keyof CustomerTableRecord]) => void;
};

const customerCardRenderStyle: CSSProperties = {
  containIntrinsicSize: "220px",
  contentVisibility: "auto",
};

function matchesMoveFilter(moveCount: number, moveFilter: MoveFilter) {
  if (moveFilter === "one") {
    return moveCount === 1;
  }

  if (moveFilter === "repeat") {
    return moveCount >= 2 && moveCount <= 3;
  }

  if (moveFilter === "heavy") {
    return moveCount >= 4;
  }

  return true;
}

function getNextCustomerNumber(customers: CustomerTableRecord[]) {
  const highestNumber = customers.reduce((maxValue, customer) => {
    const numericPart = Number.parseInt(customer.customerNumber.replace(/\D/g, ""), 10);
    return Number.isNaN(numericPart) ? maxValue : Math.max(maxValue, numericPart);
  }, 1000);

  return `KD-${String(highestNumber + 1).padStart(4, "0")}`;
}

function createEmptyCustomer(customers: CustomerTableRecord[]): CustomerTableRecord {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `kunde-${Date.now()}`,
    customerNumber: getNextCustomerNumber(customers),
    company: "",
    firstName: "",
    lastName: "",
    address: "",
    postalCode: "",
    city: "",
    phone: "",
    email: "",
    moveCount: 0,
    documents: [],
  };
}

function getCustomerDisplayName(customer: CustomerTableRecord) {
  return customer.company || `${customer.firstName} ${customer.lastName}`.trim() || customer.customerNumber;
}

function getCustomerContactName(customer: CustomerTableRecord) {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function getCustomerSubtitle(customer: CustomerTableRecord) {
  const contactName = getCustomerContactName(customer);

  if (customer.company) {
    return contactName ? `Ansprechpartner: ${contactName}` : "Firmenkunde";
  }

  return "Privatkunde";
}

function getCustomerMoveWizardPrefill(customer: CustomerTableRecord | null) {
  if (!customer) {
    return undefined;
  }

  return {
    customerNumber: customer.customerNumber,
    company: customer.company,
    firstName: customer.firstName,
    lastName: customer.lastName,
    street: customer.address,
    postalCode: customer.postalCode,
    city: customer.city,
  };
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    return null;
  }
}

function getCustomerInitials(customer: CustomerTableRecord) {
  const source = customer.company || getCustomerContactName(customer) || customer.customerNumber;

  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "KD"
  );
}

function getMoveProfileLabel(moveCount: number) {
  if (moveCount >= 4) {
    return "Stammkunde";
  }

  if (moveCount >= 2) {
    return "Wiederkehrend";
  }

  if (moveCount === 1) {
    return "1 Umzug";
  }

  return "Neu";
}

function getDocumentCategoryLabel(category: CustomerDocumentRecord["category"]) {
  if (category === "OFFER") {
    return "Angebot";
  }

  if (category === "CHECKLIST") {
    return "Checkliste";
  }

  if (category === "CONTRACT") {
    return "Vertrag";
  }

  if (category === "INVOICE") {
    return "Rechnung";
  }

  return "Sonstiges";
}

function StatCard({ accent, hint, label, lightMode, value }: StatCardProps) {
  const chrome = getPageChrome(lightMode);

  return (
    <article className={accent ? chrome.statAccentCard : chrome.statCard}>
      <p className={chrome.statLabel}>{label}</p>
      <p className={accent ? chrome.statAccentValue : chrome.statValue}>{value}</p>
      <p className={chrome.statHint}>{hint}</p>
    </article>
  );
}

function EditorField({ children, label, lightMode }: EditorFieldProps) {
  return (
    <label className="grid gap-2 text-sm">
      <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>{label}</span>
      {children}
    </label>
  );
}

const CustomerListItem = memo(
  function CustomerListItem({ customer, isSelected, lightMode, onSelectCustomer }: CustomerListItemProps) {
    const chrome = getPageChrome(lightMode);

    return (
      <button
        type="button"
        onClick={() => onSelectCustomer(customer)}
        aria-pressed={isSelected}
        style={customerCardRenderStyle}
        className={`w-full rounded-2xl p-4 text-left transition ${
          isSelected
            ? lightMode
              ? "bg-[#FF007F]/10 ring-2 ring-[#FF007F]/30"
              : "bg-[#FF007F]/12 ring-2 ring-[#FF007F]/35"
            : `${chrome.subtlePanel} hover:ring-[#FF007F]/20`
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold ${
                isSelected
                  ? "bg-[#FF007F] text-white"
                  : lightMode
                    ? "bg-white text-zinc-800 ring-1 ring-zinc-200"
                    : "bg-zinc-950 text-zinc-100 ring-1 ring-white/10"
              }`}
            >
              {getCustomerInitials(customer)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`text-base font-semibold ${chrome.bodyText}`}>{getCustomerDisplayName(customer)}</h3>
                <span className={chrome.chip}>{customer.customerNumber}</span>
              </div>
              <p className={chrome.sectionText}>{getCustomerSubtitle(customer)}</p>
              <p className={`mt-2 text-sm ${chrome.mutedText}`}>
                {customer.address}, {customer.postalCode} {customer.city}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[220px]">
            <div className={chrome.compactSurfaceMuted}>
              <p className={`text-xs uppercase tracking-[0.14em] ${chrome.overline}`}>Umzüge</p>
              <p className={`mt-1 text-lg font-semibold ${chrome.bodyText}`}>{customer.moveCount}</p>
            </div>
            <div className={chrome.compactSurfaceMuted}>
              <p className={`text-xs uppercase tracking-[0.14em] ${chrome.overline}`}>Dokumente</p>
              <p className={`mt-1 text-lg font-semibold ${chrome.bodyText}`}>{customer.documents.length}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className={chrome.neutralChip}>{customer.phone || "Telefon fehlt"}</span>
          <span className={chrome.neutralChip}>{customer.email || "E-Mail fehlt"}</span>
          <span className={chrome.chip}>{getMoveProfileLabel(customer.moveCount)}</span>
        </div>
      </button>
    );
  },
  (previousProps, nextProps) =>
    previousProps.customer === nextProps.customer &&
    previousProps.isSelected === nextProps.isSelected &&
    previousProps.lightMode === nextProps.lightMode,
);

const CustomerListPanel = memo(
  function CustomerListPanel({
    activeSelectedCustomerId,
    appliedFiltersAreActive,
    filteredCustomers,
    lightMode,
    onSelectCustomer,
  }: CustomerListPanelProps) {
    const chrome = getPageChrome(lightMode);

    return (
      <section className={chrome.panel}>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className={chrome.sectionTitle}>Kundenliste</h2>
            <p className={chrome.sectionText}>
              Jede Karte zeigt die wichtigsten Daten sofort. Ein Klick reicht, um rechts alle Details zu sehen.
            </p>
          </div>
          <span className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>
            {appliedFiltersAreActive ? "Gefilterte Ansicht" : "Alle Kunden"}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {filteredCustomers.length === 0 ? (
            <div className={chrome.emptyState}>Keine Kunden für die aktuelle Suche oder Filter gefunden.</div>
          ) : (
            filteredCustomers.map((customer) => (
              <CustomerListItem
                key={customer.id}
                customer={customer}
                isSelected={customer.id === activeSelectedCustomerId}
                lightMode={lightMode}
                onSelectCustomer={onSelectCustomer}
              />
            ))
          )}
        </div>
      </section>
    );
  },
  (previousProps, nextProps) =>
    previousProps.activeSelectedCustomerId === nextProps.activeSelectedCustomerId &&
    previousProps.appliedFiltersAreActive === nextProps.appliedFiltersAreActive &&
    previousProps.filteredCustomers === nextProps.filteredCustomers &&
    previousProps.lightMode === nextProps.lightMode,
);

const CustomerDetailsPanel = memo(
  function CustomerDetailsPanel({
    lightMode,
    onBeginEditCustomer,
    onDeleteSelectedCustomer,
    selectedCustomer,
  }: CustomerDetailsPanelProps) {
    const chrome = getPageChrome(lightMode);

    return (
      <aside className={`${chrome.panel} 2xl:sticky 2xl:top-4 2xl:self-start`}>
        <div className="flex items-center justify-between">
          <h2 className={chrome.sectionTitle}>Details</h2>
          {selectedCustomer ? (
            <span className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>{selectedCustomer.customerNumber}</span>
          ) : null}
        </div>

        {selectedCustomer ? (
          <>
            <div className={`mt-4 ${chrome.subtlePanel}`}>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FF007F] text-base font-semibold text-white">
                  {getCustomerInitials(selectedCustomer)}
                </div>
                <div>
                  <h3 className={`text-xl font-semibold ${chrome.bodyText}`}>{getCustomerDisplayName(selectedCustomer)}</h3>
                  <p className={`mt-1 text-sm ${chrome.mutedText}`}>{getCustomerSubtitle(selectedCustomer)}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className={chrome.chip}>{getMoveProfileLabel(selectedCustomer.moveCount)}</span>
                    <span className={chrome.neutralChip}>{selectedCustomer.documents.length} Dokumente</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <article className={chrome.subtlePanel}>
                <p className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>Kontakt</p>
                {selectedCustomer.company ? (
                  <p className={`mt-3 text-sm ${chrome.mutedText}`}>Firma: {selectedCustomer.company}</p>
                ) : null}
                <p className={`mt-2 text-sm ${chrome.mutedText}`}>Telefon: {selectedCustomer.phone || "nicht hinterlegt"}</p>
                <p className={`mt-2 text-sm break-all ${chrome.mutedText}`}>E-Mail: {selectedCustomer.email || "nicht hinterlegt"}</p>
              </article>

              <article className={chrome.subtlePanel}>
                <p className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>Adresse</p>
                <p className={`mt-3 text-sm ${chrome.mutedText}`}>{selectedCustomer.address || "Keine Adresse hinterlegt"}</p>
                <p className={`mt-2 text-sm ${chrome.mutedText}`}>
                  {selectedCustomer.postalCode} {selectedCustomer.city}
                </p>
              </article>

              <article className={chrome.subtlePanel}>
                <p className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>Historie</p>
                <p className={`mt-3 text-sm ${chrome.mutedText}`}>Umzüge: {selectedCustomer.moveCount}</p>
                <p className={`mt-2 text-sm ${chrome.mutedText}`}>Dokumente: {selectedCustomer.documents.length}</p>
              </article>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={onBeginEditCustomer} className={chrome.actionButton}>
                Bearbeiten
              </button>
              <button type="button" onClick={onDeleteSelectedCustomer} className={chrome.secondaryButton}>
                Löschen
              </button>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className={chrome.sectionTitle}>Dokumente</h3>
                <span className={`text-xs ${chrome.overline}`}>{selectedCustomer.documents.length} Einträge</span>
              </div>

              <div className="mt-3 space-y-3">
                {selectedCustomer.documents.length === 0 ? (
                  <div className={`${chrome.subtlePanel} text-sm`}>
                    Für diesen Kunden liegen noch keine Dokumente vor.
                  </div>
                ) : (
                  selectedCustomer.documents.map((document) => (
                    <article key={document.id} className={chrome.subtlePanel}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`font-medium ${chrome.bodyText}`}>{document.title}</p>
                          <p className={`mt-1 text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>
                            {getDocumentCategoryLabel(document.category)}
                          </p>
                        </div>
                        <span className={chrome.chip}>Datei</span>
                      </div>
                      <p className={`mt-3 text-xs ${chrome.overline}`}>Aktualisiert: {document.updatedAt}</p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <div className={`mt-4 ${chrome.emptyState}`}>
            Wähle links einen Kunden aus, um Details und Dokumente anzuzeigen.
          </div>
        )}
      </aside>
    );
  },
  (previousProps, nextProps) =>
    previousProps.lightMode === nextProps.lightMode &&
    previousProps.selectedCustomer === nextProps.selectedCustomer,
);

const CustomerEditorPanel = memo(
  function CustomerEditorPanel({
    editorDraft,
    editorMode,
    lightMode,
    onCancelEditing,
    onSaveCustomer,
    onUpdateDraft,
  }: CustomerEditorPanelProps) {
    const chrome = getPageChrome(lightMode);

    return (
      <section className={`mt-4 ${chrome.panel}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className={chrome.sectionTitle}>{editorMode === "new" ? "Neuen Kunden anlegen" : "Kundendaten bearbeiten"}</h2>
            <p className={chrome.sectionText}>
              Die Änderungen werden aktuell direkt in dieser Ansicht verwaltet und lassen sich später an echte API-Operationen
              koppeln.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onCancelEditing} className={chrome.secondaryButton}>
              Abbrechen
            </button>
            <button type="button" onClick={onSaveCustomer} className={chrome.actionButton}>
              Speichern
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <div className={chrome.subtlePanel}>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#FF007F]">Stammdaten</h3>
            <div className="mt-4 grid gap-3">
              <EditorField label="Kundennummer" lightMode={lightMode}>
                <input
                  value={editorDraft.customerNumber}
                  onChange={(event) => onUpdateDraft("customerNumber", event.target.value)}
                  className={chrome.input}
                  placeholder="KD-1009"
                />
              </EditorField>
              <EditorField label="Firma" lightMode={lightMode}>
                <input
                  value={editorDraft.company}
                  onChange={(event) => onUpdateDraft("company", event.target.value)}
                  className={chrome.input}
                  placeholder="Firma oder leer bei Privatkunde"
                />
              </EditorField>
              <EditorField label="Vorname" lightMode={lightMode}>
                <input
                  value={editorDraft.firstName}
                  onChange={(event) => onUpdateDraft("firstName", event.target.value)}
                  className={chrome.input}
                  placeholder="Vorname"
                />
              </EditorField>
              <EditorField label="Nachname" lightMode={lightMode}>
                <input
                  value={editorDraft.lastName}
                  onChange={(event) => onUpdateDraft("lastName", event.target.value)}
                  className={chrome.input}
                  placeholder="Nachname"
                />
              </EditorField>
            </div>
          </div>

          <div className={chrome.subtlePanel}>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#FF007F]">Adresse</h3>
            <div className="mt-4 grid gap-3">
              <EditorField label="Adresse" lightMode={lightMode}>
                <input
                  value={editorDraft.address}
                  onChange={(event) => onUpdateDraft("address", event.target.value)}
                  className={chrome.input}
                  placeholder="Straße und Hausnummer"
                />
              </EditorField>
              <EditorField label="PLZ" lightMode={lightMode}>
                <input
                  value={editorDraft.postalCode}
                  onChange={(event) => onUpdateDraft("postalCode", event.target.value)}
                  className={chrome.input}
                  placeholder="PLZ"
                />
              </EditorField>
              <EditorField label="Ort" lightMode={lightMode}>
                <input
                  value={editorDraft.city}
                  onChange={(event) => onUpdateDraft("city", event.target.value)}
                  className={chrome.input}
                  placeholder="Ort"
                />
              </EditorField>
            </div>
          </div>

          <div className={chrome.subtlePanel}>
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#FF007F]">Kontakt und Historie</h3>
            <div className="mt-4 grid gap-3">
              <EditorField label="Telefon" lightMode={lightMode}>
                <input
                  value={editorDraft.phone}
                  onChange={(event) => onUpdateDraft("phone", event.target.value)}
                  className={chrome.input}
                  placeholder="Telefonnummer"
                />
              </EditorField>
              <EditorField label="E-Mail" lightMode={lightMode}>
                <input
                  value={editorDraft.email}
                  onChange={(event) => onUpdateDraft("email", event.target.value)}
                  className={chrome.input}
                  placeholder="E-Mail-Adresse"
                />
              </EditorField>
              <EditorField label="Anzahl Umzüge" lightMode={lightMode}>
                <input
                  type="number"
                  min={0}
                  value={editorDraft.moveCount}
                  onChange={(event) => onUpdateDraft("moveCount", Number(event.target.value))}
                  className={chrome.input}
                  placeholder="0"
                />
              </EditorField>
            </div>
          </div>
        </div>
      </section>
    );
  },
  (previousProps, nextProps) =>
    previousProps.editorDraft === nextProps.editorDraft &&
    previousProps.editorMode === nextProps.editorMode &&
    previousProps.lightMode === nextProps.lightMode,
);

function CustomersPageContent({ initialCustomers }: { initialCustomers: CustomerTableRecord[] }) {
  const router = useRouter();
  const { lightMode } = useDashboardAppearance();
  const { openMoveWizard } = useMoveWizard();
  const chrome = getPageChrome(lightMode);
  const [customers, setCustomers] = useState(initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomers[0]?.id ?? null);
  const [editorMode, setEditorMode] = useState<CustomerEditorMode>(null);
  const [editorDraft, setEditorDraft] = useState<CustomerTableRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [moveFilter, setMoveFilter] = useState<MoveFilter>("all");
  const [statusMessage, setStatusMessage] = useState(
    "Die Kundenansicht ist jetzt eigenständig. Wähle links einen Eintrag aus oder starte direkt mit einem neuen Kunden.",
  );
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
  const immediateSearch = searchTerm.trim().toLowerCase();
  const searchIsDeferred = deferredSearchTerm !== searchTerm;
  const filtersAreActive = immediateSearch.length > 0 || cityFilter !== "all" || moveFilter !== "all";
  const appliedFiltersAreActive = normalizedSearch.length > 0 || cityFilter !== "all" || moveFilter !== "all";
  const { cityOptions, customersWithDocuments, filteredCustomers, privateCustomers, repeatCustomers } = useMemo(() => {
    const cities = new Set<string>();
    let nextPrivateCustomers = 0;
    let nextCustomersWithDocuments = 0;
    let nextRepeatCustomers = 0;

    for (const customer of customers) {
      if (customer.city) {
        cities.add(customer.city);
      }

      if (customer.company.trim().length === 0) {
        nextPrivateCustomers += 1;
      }

      if (customer.documents.length > 0) {
        nextCustomersWithDocuments += 1;
      }

      if (customer.moveCount >= 2) {
        nextRepeatCustomers += 1;
      }
    }

    const nextFilteredCustomers = customers.filter((customer) => {
      const searchableText = [
        customer.customerNumber,
        customer.company,
        customer.firstName,
        customer.lastName,
        customer.address,
        customer.city,
        customer.phone,
        customer.email,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = normalizedSearch.length === 0 || searchableText.includes(normalizedSearch);
      const matchesCity = cityFilter === "all" || customer.city === cityFilter;

      return matchesSearch && matchesCity && matchesMoveFilter(customer.moveCount, moveFilter);
    });

    return {
      cityOptions: Array.from(cities).sort((leftSide, rightSide) => leftSide.localeCompare(rightSide, "de")),
      customersWithDocuments: nextCustomersWithDocuments,
      filteredCustomers: nextFilteredCustomers,
      privateCustomers: nextPrivateCustomers,
      repeatCustomers: nextRepeatCustomers,
    };
  }, [customers, cityFilter, moveFilter, normalizedSearch]);
  const activeSelectedCustomerId = useMemo(
    () =>
      filteredCustomers.some((customer) => customer.id === selectedCustomerId) ? selectedCustomerId : filteredCustomers[0]?.id ?? null,
    [filteredCustomers, selectedCustomerId],
  );
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === activeSelectedCustomerId) ?? null,
    [activeSelectedCustomerId, customers],
  );

  function selectCustomer(customer: CustomerTableRecord) {
    setSelectedCustomerId(customer.id);
    setStatusMessage(`${customer.customerNumber} | ${getCustomerDisplayName(customer)} ausgewählt.`);
  }

  function beginCreateCustomer() {
    setEditorMode("new");
    setEditorDraft(createEmptyCustomer(customers));
    setStatusMessage("Neuer Kunde wird angelegt.");
  }

  function beginEditCustomer() {
    if (!selectedCustomer) {
      return;
    }

    setEditorMode("edit");
    setEditorDraft({ ...selectedCustomer, documents: [...selectedCustomer.documents] });
    setStatusMessage(`${selectedCustomer.customerNumber} ist zur Bearbeitung geöffnet.`);
  }

  async function saveCustomer() {
    if (!editorDraft) {
      return;
    }

    const preparedCustomer = {
      ...editorDraft,
      customerNumber: editorDraft.customerNumber.trim(),
      company: editorDraft.company.trim(),
      firstName: editorDraft.firstName.trim(),
      lastName: editorDraft.lastName.trim(),
      address: editorDraft.address.trim(),
      postalCode: editorDraft.postalCode.trim(),
      city: editorDraft.city.trim(),
      phone: editorDraft.phone.trim(),
      email: editorDraft.email.trim(),
    };

    try {
      const response = await fetch(
        editorMode === "new" ? "/api/customers" : `/api/customers/${preparedCustomer.id}`,
        {
          body: JSON.stringify(preparedCustomer),
          headers: {
            "Content-Type": "application/json",
          },
          method: editorMode === "new" ? "POST" : "PUT",
        },
      );
      const payload = await readJsonResponse<{ customer?: CustomerTableRecord; message?: string }>(response);

      if (!response.ok || !payload?.customer) {
        throw new Error(payload?.message || "Der Kunde konnte nicht gespeichert werden.");
      }

      const savedCustomer = payload.customer;

      setCustomers((currentCustomers) =>
        editorMode === "new"
          ? [savedCustomer, ...currentCustomers]
          : currentCustomers.map((customer) => (customer.id === savedCustomer.id ? savedCustomer : customer)),
      );
      setSelectedCustomerId(savedCustomer.id);
      setEditorDraft(null);
      setEditorMode(null);
      setStatusMessage(`${savedCustomer.customerNumber} | ${getCustomerDisplayName(savedCustomer)} gespeichert.`);
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Der Kunde konnte nicht gespeichert werden.");
    }
  }

  function cancelEditing() {
    setEditorDraft(null);
    setEditorMode(null);
    setStatusMessage("Bearbeitung verworfen.");
  }

  async function deleteSelectedCustomer() {
    if (!selectedCustomer) {
      return;
    }

    if (!window.confirm(`${selectedCustomer.customerNumber} wirklich aus der Ansicht entfernen?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "DELETE",
      });
      const payload = await readJsonResponse<{ message?: string }>(response);

      if (!response.ok) {
        throw new Error(payload?.message || "Der Kunde konnte nicht gelöscht werden.");
      }

      const remainingCustomers = customers.filter((customer) => customer.id !== selectedCustomer.id);
      setCustomers(remainingCustomers);
      setSelectedCustomerId(remainingCustomers[0]?.id ?? null);

      if (editorDraft?.id === selectedCustomer.id) {
        setEditorDraft(null);
        setEditorMode(null);
      }

      setStatusMessage(`${selectedCustomer.customerNumber} wurde gelöscht.`);
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Der Kunde konnte nicht gelöscht werden.");
    }
  }

  function resetFilters() {
    setSearchTerm("");
    setCityFilter("all");
    setMoveFilter("all");
    setStatusMessage("Filter zurückgesetzt. Es werden wieder alle Kunden angezeigt.");
  }

  function updateDraft<Key extends keyof CustomerTableRecord>(field: Key, value: CustomerTableRecord[Key]) {
    setEditorDraft((currentDraft) => (currentDraft ? { ...currentDraft, [field]: value } : currentDraft));
  }

  const panelClass = chrome.panel;
  const inputClass = chrome.input;
  const actionButtonClass = chrome.actionButton;
  const secondaryButtonClass = chrome.secondaryButton;

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Eigenständige Kundenansicht</p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className={chrome.heroTitle}>Kunden</h1>
            <p className={chrome.heroText}>
              Kontakte, Dokumente und Umzugshistorie in einer klaren Arbeitsansicht statt in einer breiten Tabellenwüste.
            </p>
          </div>

          {selectedCustomer ? (
            <div className={chrome.heroAccentCard}>
              <p className={chrome.heroAccentEyebrow}>Aktiver Fokus</p>
              <p className={chrome.heroAccentValue}>{getCustomerDisplayName(selectedCustomer)}</p>
              <p className={chrome.heroAccentMeta}>{selectedCustomer.customerNumber}</p>
            </div>
          ) : null}
        </div>
      </header>

      <div className={chrome.statsGrid}>
        <StatCard
          accent
          hint="sichtbar in der Kundenbasis"
          label="Kunden gesamt"
          lightMode={lightMode}
          value={customers.length}
        />
        <StatCard
          hint="ohne Firmenzuordnung"
          label="Privatkunden"
          lightMode={lightMode}
          value={privateCustomers}
        />
        <StatCard
          hint="mit mindestens 2 Umzügen"
          label="Wiederkehrend"
          lightMode={lightMode}
          value={repeatCustomers}
        />
        <StatCard
          hint="mit vorhandenen Unterlagen"
          label="Dokumente aktiv"
          lightMode={lightMode}
          value={customersWithDocuments}
        />
      </div>

      <section className={panelClass}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className={chrome.sectionTitle}>Arbeitsbereich</h2>
            <p className={chrome.sectionText}>
              Suche, Filter und Aktionen sind jetzt kompakt an einer Stelle gebündelt.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={beginCreateCustomer} className={actionButtonClass}>
              Neuer Kunde
            </button>
            <button
              type="button"
              onClick={() =>
                openMoveWizard({
                  customerId: selectedCustomer?.id,
                  sourceLabel: "Kunden",
                  customerPrefill: getCustomerMoveWizardPrefill(selectedCustomer),
                  onCreated: () => router.refresh(),
                })
              }
              className={actionButtonClass}
            >
              Umzug anlegen
            </button>
            <button type="button" onClick={resetFilters} className={secondaryButtonClass} disabled={!filtersAreActive}>
              Filter zurücksetzen
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)_minmax(180px,1fr)]">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={inputClass}
            placeholder="Suche nach Kundennummer, Firma, Ansprechpartner, Ort oder E-Mail"
          />
          <select value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} className={inputClass}>
            <option value="all">Alle Orte</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <select
            value={moveFilter}
            onChange={(event) => setMoveFilter(event.target.value as MoveFilter)}
            className={inputClass}
          >
            <option value="all">Alle Umzüge</option>
            <option value="one">1 Umzug</option>
            <option value="repeat">2-3 Umzüge</option>
            <option value="heavy">4+ Umzüge</option>
          </select>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className={`${chrome.subtleInset} text-sm`}>
            {filteredCustomers.length} von {customers.length} Kunden sichtbar
            {searchIsDeferred ? " | Suche wird aktualisiert..." : ""}
          </div>
          <div className={`${chrome.subtleInset} text-sm`}>
            {selectedCustomer
              ? `Ausgewählt: ${selectedCustomer.customerNumber} | ${getCustomerDisplayName(selectedCustomer)}`
              : "Kein Kunde ausgewählt"}
          </div>
        </div>

        <div className={`mt-3 ${chrome.subtleInset} text-sm`}>{statusMessage}</div>
      </section>

      {editorDraft ? (
        <CustomerEditorPanel
          editorDraft={editorDraft}
          editorMode={editorMode ?? "edit"}
          lightMode={lightMode}
          onCancelEditing={cancelEditing}
          onSaveCustomer={saveCustomer}
          onUpdateDraft={updateDraft}
        />
      ) : null}

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)]">
        <CustomerListPanel
          activeSelectedCustomerId={activeSelectedCustomerId}
          appliedFiltersAreActive={appliedFiltersAreActive}
          filteredCustomers={filteredCustomers}
          lightMode={lightMode}
          onSelectCustomer={selectCustomer}
        />

        <CustomerDetailsPanel
          lightMode={lightMode}
          onBeginEditCustomer={beginEditCustomer}
          onDeleteSelectedCustomer={deleteSelectedCustomer}
          selectedCustomer={selectedCustomer}
        />
      </div>
    </div>
  );
}

export default function KundenPageClient({ initialCustomers }: { initialCustomers: CustomerTableRecord[] }) {
  return <CustomersPageContent initialCustomers={initialCustomers} />;
}
