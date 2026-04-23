"use client";

import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { useMoveWizard } from "@/app/_components/move-wizard";
import { getPageChrome } from "@/app/_components/page-styles";
import type { MoveRecord } from "@/lib/move-data";

type StoredDocumentFile = {
  fileName: string;
  relativePath: string;
  title: string;
  updatedAt: string;
};

function buildDocumentUrl(relativePath: string) {
  return `/api/documents/file?path=${encodeURIComponent(relativePath)}`;
}

function findDocumentByKind(files: StoredDocumentFile[], kind: "angebot" | "rechnung" | "checkliste") {
  const needle = kind === "checkliste" ? "checkliste" : kind;
  return (
    files.find((file) => file.fileName.toLowerCase().includes(needle)) ??
    files.find((file) => file.title.toLowerCase().includes(needle)) ??
    null
  );
}

function getMoveStatusLabel(status: string) {
  if (status === "PLANNED") {
    return "Geplant";
  }

  if (status === "IN_PROGRESS") {
    return "In Arbeit";
  }

  if (status === "COMPLETED") {
    return "Abgeschlossen";
  }

  if (status === "CANCELLED") {
    return "Storniert";
  }

  return "Lead";
}

function MoveActionsMenu({
  lightMode,
  move,
  isOpen,
  onClose,
  onRequestSchedule,
  onRequestComplete,
  onRequestEdit,
}: {
  lightMode: boolean;
  move: MoveRecord;
  isOpen: boolean;
  onClose: () => void;
  onRequestSchedule: () => void;
  onRequestComplete: () => void;
  onRequestEdit: () => void;
}) {
  const chrome = getPageChrome(lightMode);
  const menuSurface = lightMode
    ? "border-zinc-200 bg-white shadow-xl shadow-zinc-900/10"
    : "border-white/10 bg-zinc-950 shadow-xl shadow-black/40";
  const menuItem =
    "flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-left text-sm transition " +
    (lightMode ? "hover:bg-zinc-100 text-zinc-900" : "hover:bg-white/10 text-zinc-100");

  async function download(kind: "angebot" | "rechnung" | "checkliste") {
    try {
      const response = await fetch(`/api/moves/${encodeURIComponent(move.id)}/documents`, { method: "GET" });
      const payload = (await response.json()) as { files?: StoredDocumentFile[]; message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Dokumente konnten nicht geladen werden.");
      }

      const files = payload.files ?? [];
      const match = findDocumentByKind(files, kind);
      if (!match) {
        throw new Error("Dokument wurde noch nicht erzeugt.");
      }

      window.open(buildDocumentUrl(match.relativePath), "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Download fehlgeschlagen.";
      window.alert(message);
    } finally {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div className={`absolute right-0 top-10 z-20 w-[260px] rounded-xl border p-2 ${menuSurface}`}>
      <p className={`px-3 py-2 text-xs ${chrome.overline}`}>Aktionen</p>
      <button type="button" className={menuItem} onClick={() => void download("angebot")}>
        Angebot herunterladen
        <span className={chrome.overline}>PDF</span>
      </button>
      <button type="button" className={menuItem} onClick={() => void download("rechnung")}>
        Rechnung herunterladen
        <span className={chrome.overline}>PDF</span>
      </button>
      <button type="button" className={menuItem} onClick={() => void download("checkliste")}>
        Checkliste herunterladen
        <span className={chrome.overline}>PDF</span>
      </button>
      <div className={`my-2 h-px ${lightMode ? "bg-zinc-200" : "bg-white/10"}`} />
      <button type="button" className={menuItem} onClick={onRequestEdit}>
        Bearbeiten
        <span className={chrome.overline}>Wizard</span>
      </button>
      <button
        type="button"
        className={menuItem}
        onClick={onRequestSchedule}
        disabled={move.status === "CANCELLED" || move.status === "COMPLETED"}
      >
        Zeitraum einstellen
        <span className={chrome.overline}>Plan</span>
      </button>
      {move.status === "PLANNED" || move.status === "IN_PROGRESS" ? (
        <button type="button" className={menuItem} onClick={onRequestComplete}>
          Abschluss
          <span className={chrome.overline}>Status</span>
        </button>
      ) : null}
    </div>
  );
}

function MoveTableRow({
  lightMode,
  move,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onRequestSchedule,
  onRequestComplete,
  onRequestEdit,
}: {
  lightMode: boolean;
  move: MoveRecord;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onRequestSchedule: () => void;
  onRequestComplete: () => void;
  onRequestEdit: () => void;
}) {
  const chrome = getPageChrome(lightMode);
  const cellTextClass = lightMode ? "text-zinc-800" : "text-zinc-200";

  return (
    <tr className={`${lightMode ? "bg-white" : "bg-zinc-950"} transition`}>
      <td className={`px-3 py-3 align-top ${cellTextClass}`}>
        <div className="min-w-[220px]">
          <p className="font-semibold text-[#FF007F]">{move.moveNumber}</p>
          <p className="mt-1 text-sm">{move.customerName}</p>
          <p className={`mt-1 text-xs ${chrome.overline}`}>{move.customerNumber}</p>
        </div>
      </td>
      <td className={`px-3 py-3 align-top text-sm ${cellTextClass}`}>{move.originAddress}</td>
      <td className={`px-3 py-3 align-top text-sm ${cellTextClass}`}>{move.destinationAddress}</td>
      <td className={`px-3 py-3 align-top text-sm ${cellTextClass}`}>{move.plannedDate}</td>
      <td className="px-3 py-3 align-top">
        <span className={chrome.neutralChip}>{getMoveStatusLabel(move.status)}</span>
      </td>
      <td className={`px-3 py-3 align-top text-sm ${cellTextClass}`}>{move.documentCount}</td>
      <td className={`px-3 py-3 align-top text-xs ${chrome.overline}`}>
        {move.customerNumber} / Umzuege / {move.moveNumber}
      </td>
      <td className="relative px-3 py-3 align-top">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleMenu();
          }}
          className={`inline-flex h-9 w-10 items-center justify-center rounded-xl border text-sm transition ${
            lightMode
              ? "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
              : "border-white/10 bg-zinc-950 text-zinc-200 hover:bg-white/10"
          }`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Aktionen"
        >
          <span className="sr-only">Aktionen</span>
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
        <div
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          role="presentation"
        >
          <MoveActionsMenu
            lightMode={lightMode}
            move={move}
            isOpen={menuOpen}
            onClose={onCloseMenu}
            onRequestSchedule={onRequestSchedule}
            onRequestComplete={onRequestComplete}
            onRequestEdit={onRequestEdit}
          />
        </div>
      </td>
    </tr>
  );
}

function ScheduleModal({
  lightMode,
  move,
  onClose,
  onSaved,
}: {
  lightMode: boolean;
  move: MoveRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const chrome = getPageChrome(lightMode);
  const surface = lightMode ? "border-zinc-200 bg-white" : "border-white/10 bg-zinc-950";
  const [startValue, setStartValue] = useState("");
  const [endValue, setEndValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setStartValue("");
    setEndValue("");
  }, [move.id]);

  async function save() {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/moves/${encodeURIComponent(move.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plannedStartDate: startValue || null,
          plannedEndDate: endValue || null,
          status: "PLANNED",
        }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Zeitraum konnte nicht gespeichert werden.");
      }
      onSaved();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Zeitraum konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Schließen" />
      <div className={`relative w-full max-w-xl rounded-2xl border p-5 ${surface}`}>
        <p className={chrome.heroEyebrow}>Zeitraum</p>
        <h2 className={`mt-2 text-xl font-semibold ${chrome.bodyText}`}>Umzug {move.moveNumber} planen</h2>
        <p className={`mt-1 text-sm ${chrome.mutedText}`}>Setzt den Status auf „Geplant“ und zeigt den Termin im Kalender.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="grid gap-1">
            <span className={`text-xs ${chrome.overline}`}>Start</span>
            <input type="datetime-local" value={startValue} onChange={(event) => setStartValue(event.target.value)} className={chrome.input} />
          </label>
          <label className="grid gap-1">
            <span className={`text-xs ${chrome.overline}`}>Ende (optional)</span>
            <input type="datetime-local" value={endValue} onChange={(event) => setEndValue(event.target.value)} className={chrome.input} />
          </label>
        </div>

        {errorMessage ? (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              lightMode ? "border-red-200 bg-red-50 text-red-700" : "border-red-900/40 bg-red-950/40 text-red-100"
            }`}
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={chrome.secondaryButton} disabled={isSaving}>
            Abbrechen
          </button>
          <button type="button" onClick={() => void save()} className={chrome.actionButton} disabled={isSaving || !startValue}>
            {isSaving ? "Speichere..." : "Zeitraum speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UmzuegePageContent({ initialMoves }: { initialMoves: MoveRecord[] }) {
  const router = useRouter();
  const { lightMode } = useDashboardAppearance();
  const { openMoveWizard } = useMoveWizard();
  const chrome = getPageChrome(lightMode);
  const [moves, setMoves] = useState(initialMoves);
  const [searchTerm, setSearchTerm] = useState("");
  const [openMenuMoveId, setOpenMenuMoveId] = useState<string | null>(null);
  const [scheduleMove, setScheduleMove] = useState<MoveRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    "Die Umzugsliste arbeitet jetzt mit echten Daten aus der Datenbank und legt für neue Einträge automatisch Unterordner an.",
  );

  useEffect(() => {
    setMoves(initialMoves);
  }, [initialMoves]);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
  const searchIsDeferred = deferredSearchTerm !== searchTerm;
  const filteredMoves = useMemo(
    () =>
      moves.filter((move) => {
        const searchableText = [
          move.moveNumber,
          move.customerNumber,
          move.customerName,
          move.originAddress,
          move.destinationAddress,
          move.plannedDate,
          move.status,
        ]
          .join(" ")
          .toLowerCase();

        return normalizedSearch.length === 0 || searchableText.includes(normalizedSearch);
      }),
    [moves, normalizedSearch],
  );
  const involvedCustomers = useMemo(() => new Set(moves.map((move) => move.customerId)).size, [moves]);
  const totalDocumentFolders = useMemo(
    () => moves.reduce((sum, move) => sum + move.documentCount, 0),
    [moves],
  );

  function resetSearch() {
    setSearchTerm("");
    setStatusMessage("Suche zurückgesetzt. Alle Umzüge sind wieder sichtbar.");
  }

  useEffect(() => {
    function onGlobalClick() {
      setOpenMenuMoveId(null);
    }

    window.addEventListener("click", onGlobalClick);
    return () => window.removeEventListener("click", onGlobalClick);
  }, []);

  async function markMoveCompleted(move: MoveRecord) {
    const confirmed = window.confirm(`Umzug ${move.moveNumber} wirklich abschließen? Status wird auf „Abgeschlossen“ gesetzt.`);
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/moves/${encodeURIComponent(move.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Status konnte nicht aktualisiert werden.");
      }

      setMoves((previous) => previous.map((entry) => (entry.id === move.id ? { ...entry, status: "COMPLETED" } : entry)));
      setStatusMessage(`Umzug ${move.moveNumber} wurde abgeschlossen.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Status konnte nicht aktualisiert werden.");
    } finally {
      setOpenMenuMoveId(null);
    }
  }

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Umzugsplanung</p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className={chrome.heroTitle}>Umzüge</h1>
            <p className={chrome.heroText}>
              Jede neue Anlage erzeugt jetzt direkt einen echten Umzug in der Datenbank und den passenden Unterordner im
              Dokumentensystem.
            </p>
          </div>
          <div className={chrome.heroAccentCard}>
            <p className={chrome.heroAccentEyebrow}>Sichtbar</p>
            <p className={chrome.heroAccentValue}>{filteredMoves.length} Umzüge</p>
            <p className={chrome.heroAccentMeta}>{searchIsDeferred ? "Suche wird aktualisiert..." : "Live-Ansicht"}</p>
          </div>
        </div>
      </header>

      <div className={chrome.statsGrid}>
        <article className={chrome.statAccentCard}>
          <p className={chrome.statLabel}>Umzüge gesamt</p>
          <p className={chrome.statAccentValue}>{moves.length}</p>
          <p className={chrome.statHint}>in der Datenbank</p>
        </article>
        <article className={chrome.statCard}>
          <p className={chrome.statLabel}>Kunden beteiligt</p>
          <p className={chrome.statValue}>{involvedCustomers}</p>
          <p className={chrome.statHint}>eindeutige Kunden</p>
        </article>
        <article className={chrome.statCard}>
          <p className={chrome.statLabel}>Dokumente im Umzug</p>
          <p className={chrome.statValue}>{totalDocumentFolders}</p>
          <p className={chrome.statHint}>Dateien in Umzugsordnern</p>
        </article>
        <article className={chrome.statCard}>
          <p className={chrome.statLabel}>Ordnerpfade</p>
          <p className={chrome.statValue}>{moves.length}</p>
          <p className={chrome.statHint}>automatisch erzeugt</p>
        </article>
      </div>

      <section className={chrome.panel}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className={chrome.sectionTitle}>Arbeitsbereich</h2>
            <p className={chrome.sectionText}>
              Suche nach Kunde, Umzugsnummer oder Adresse. Neue Umzüge werden direkt produktiv gespeichert.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                openMoveWizard({
                  sourceLabel: "Umzüge",
                  onCreated: () => router.refresh(),
                })
              }
              className={chrome.actionButton}
            >
              Umzug anlegen
            </button>
            <button type="button" onClick={resetSearch} className={chrome.secondaryButton}>
              Suche zurücksetzen
            </button>
          </div>
        </div>

        <div className="mt-4">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={chrome.input}
            placeholder="Suche nach Kunde, Umzugsnummer oder Adresse"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
          <div className={`${chrome.subtleInset} text-sm`}>
            {filteredMoves.length} von {moves.length} Umzügen sichtbar
          </div>
          <div className={`${chrome.subtleInset} text-sm`}>{statusMessage}</div>
        </div>
      </section>

      <section className={chrome.panel}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className={chrome.sectionTitle}>Umzugsübersicht</h2>
            <p className={chrome.sectionText}>
              Kundenbezug, Start, Ziel, Termin, Status und der erzeugte Dokumentenpfad in einer kompakten Tabelle.
            </p>
          </div>
        </div>

        {filteredMoves.length === 0 ? (
          <div className={`mt-4 ${chrome.emptyState}`}>
            {moves.length === 0 ? "Noch keine Umzüge vorhanden. Lege den ersten Umzug direkt über den Wizard an." : "Keine Umzüge für die aktuelle Suche gefunden."}
          </div>
        ) : (
	          <div className="mt-4 overflow-x-auto">
	            <table className="min-w-[1100px] w-full border-separate border-spacing-y-2">
	              <thead>
	                <tr>
	                  {["Umzug", "Start", "Ziel", "Termin", "Status", "Dateien", "Ordnerpfad", ""].map((label) => (
	                    <th key={label} scope="col" className={chrome.tableHeadCell}>
	                      {label}
	                    </th>
	                  ))}
	                </tr>
	              </thead>
	              <tbody>
	                {filteredMoves.map((move) => (
	                  <MoveTableRow
	                    key={move.id}
	                    lightMode={lightMode}
	                    move={move}
	                    menuOpen={openMenuMoveId === move.id}
	                    onToggleMenu={() => setOpenMenuMoveId((previous) => (previous === move.id ? null : move.id))}
	                    onCloseMenu={() => setOpenMenuMoveId(null)}
	                    onRequestSchedule={() => {
	                      setOpenMenuMoveId(null);
	                      setScheduleMove(move);
	                    }}
	                    onRequestComplete={() => void markMoveCompleted(move)}
	                    onRequestEdit={() => {
	                      setOpenMenuMoveId(null);
	                      openMoveWizard({
	                        moveId: move.id,
	                        sourceLabel: "Umzüge",
	                        onCreated: () => router.refresh(),
	                      });
	                    }}
	                  />
	                ))}
	              </tbody>
	            </table>
	          </div>
	        )}
	      </section>

	      {scheduleMove ? (
	        <ScheduleModal
	          lightMode={lightMode}
	          move={scheduleMove}
	          onClose={() => setScheduleMove(null)}
	          onSaved={() => {
	            router.refresh();
	            setStatusMessage(`Zeitraum für ${scheduleMove.moveNumber} gespeichert. Status ist jetzt „Geplant“.`);
	          }}
	        />
	      ) : null}
	    </div>
	  );
	}

export default function UmzuegePageClient({ initialMoves }: { initialMoves: MoveRecord[] }) {
  return <UmzuegePageContent initialMoves={initialMoves} />;
}
