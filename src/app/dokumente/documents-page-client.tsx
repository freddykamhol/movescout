"use client";

import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";
import type { DocumentLibraryCustomerRecord, DocumentLibraryMoveRecord } from "@/lib/documents-data";

type FolderFilter = "all" | "customer" | "moves";
type ExplorerViewMode = "details" | "tiles";
type SelectedNode =
  | { kind: "root" }
  | { customerId: string; kind: "customer" }
  | { customerId: string; kind: "customer-documents" }
  | { customerId: string; kind: "moves-root" }
  | { customerId: string; kind: "move"; moveId: string }
  | { customerId: string; kind: "move-documents"; moveId: string }
  | null;

type ExplorerItem = {
  badge?: string;
  detail: string;
  fileName?: string;
  id: string;
  kind: "document" | "folder";
  name: string;
  openUrl?: string;
  relativePath?: string;
  subtitle: string;
  targetNode?: Exclude<SelectedNode, null>;
  typeLabel: string;
  updatedLabel: string;
};

const explorerViewModeStorageKey = "movescout.documents.explorer-view-mode";
const explorerViewModeEventName = "movescout:documents-view-mode";
const documentsLibraryRefreshEventName = "movescout:documents-library-refresh";

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

function getStoredExplorerViewMode(): ExplorerViewMode {
  if (typeof window === "undefined") {
    return "details";
  }

  const storedViewMode = window.localStorage.getItem(explorerViewModeStorageKey);
  return storedViewMode === "tiles" ? "tiles" : "details";
}

function subscribeToExplorerViewMode(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStoreChange = (event: Event) => {
    if (event instanceof StorageEvent && event.key && event.key !== explorerViewModeStorageKey) {
      return;
    }

    onStoreChange();
  };

  window.addEventListener("storage", handleStoreChange);
  window.addEventListener(explorerViewModeEventName, handleStoreChange);

  return () => {
    window.removeEventListener("storage", handleStoreChange);
    window.removeEventListener(explorerViewModeEventName, handleStoreChange);
  };
}

function persistExplorerViewMode(nextViewMode: ExplorerViewMode) {
  window.localStorage.setItem(explorerViewModeStorageKey, nextViewMode);
  window.dispatchEvent(new Event(explorerViewModeEventName));
}

function FolderIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 7.5h6l2 2H21v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 7.5a2 2 0 0 1 2-2h4l2 2" />
    </svg>
  );
}

function FileIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

function ChevronRightIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function DotsIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function getCustomerDisplayName(customer: DocumentLibraryCustomerRecord) {
  return customer.company || `${customer.firstName} ${customer.lastName}`.trim() || customer.customerNumber;
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

function getNodeKey(node: SelectedNode) {
  if (!node) {
    return "empty";
  }

  if (node.kind === "root") {
    return "root";
  }

  if (node.kind === "customer" || node.kind === "customer-documents" || node.kind === "moves-root") {
    return `${node.kind}:${node.customerId}`;
  }

  return `${node.kind}:${node.customerId}:${node.moveId}`;
}

function isNodeSelected(node: SelectedNode, candidate: Exclude<SelectedNode, null>) {
  return getNodeKey(node) === getNodeKey(candidate);
}

function getInitialSelectedNode(customers: DocumentLibraryCustomerRecord[], folderFilter: FolderFilter): SelectedNode {
  void customers;
  void folderFilter;

  return { kind: "root" };
}

function isNodeVisible(node: SelectedNode, customers: DocumentLibraryCustomerRecord[], folderFilter: FolderFilter) {
  if (!node) {
    return customers.length === 0;
  }

  if (node.kind === "root") {
    return true;
  }

  const customer = customers.find((entry) => entry.id === node.customerId);

  if (!customer) {
    return false;
  }

  if (folderFilter === "customer" && (node.kind === "moves-root" || node.kind === "move" || node.kind === "move-documents")) {
    return false;
  }

  if (folderFilter === "moves" && node.kind === "customer-documents") {
    return false;
  }

  if (node.kind === "move" || node.kind === "move-documents") {
    return customer.moves.some((move) => move.id === node.moveId);
  }

  return true;
}

function getSelectedNodeTitle(
  customer: DocumentLibraryCustomerRecord | null,
  node: SelectedNode,
  move: DocumentLibraryMoveRecord | null,
) {
  if (!node) {
    return "Kein Ordner geöffnet";
  }

  if (node.kind === "root") {
    return "Kunden";
  }

  if (!customer) {
    return "Ordner nicht verfügbar";
  }

  if (node.kind === "customer") {
    return getCustomerDisplayName(customer);
  }

  if (node.kind === "customer-documents") {
    return "Kundendokumente";
  }

  if (node.kind === "moves-root") {
    return "Umzüge";
  }

  if (node.kind === "move") {
    return move?.moveNumber ?? "Umzugsordner";
  }

  return "Umzugsbezogen";
}

function getSelectedNodeSubtitle(
  customer: DocumentLibraryCustomerRecord | null,
  node: SelectedNode,
  move: DocumentLibraryMoveRecord | null,
) {
  if (!node) {
    return "Wähle links einen Ordner aus.";
  }

  if (node.kind === "root") {
    return "Startebene mit allen Kundenordnern. Öffne Ordner direkt aus dem Inhaltsbereich.";
  }

  if (!customer) {
    return "Der ausgewählte Ordner ist nicht mehr verfügbar.";
  }

  if (node.kind === "customer") {
    return "Kundenordner mit den Unterordnern Kundendokumente und Umzüge.";
  }

  if (node.kind === "customer-documents") {
    return `Allgemeine Unterlagen für ${getCustomerDisplayName(customer)}.`;
  }

  if (node.kind === "moves-root") {
    return `Alle Umzugsordner von ${getCustomerDisplayName(customer)}.`;
  }

  if (node.kind === "move") {
    return move ? `${move.routeLabel} | ${move.scheduleLabel}` : "Dieser Umzugsordner ist nicht mehr verfügbar.";
  }

  return move
    ? `Dokumente zum Umzug ${move.moveNumber} von ${getCustomerDisplayName(customer)}.`
    : "Der zugehörige Umzug konnte nicht mehr geladen werden.";
}

function getEmptyStateMessage(node: SelectedNode) {
  if (!node) {
    return "Kein Ordner ausgewählt.";
  }

  if (node.kind === "root") {
    return "Im Root liegen aktuell keine Kundenordner.";
  }

  if (node.kind === "customer-documents") {
    return "In diesem Kundenordner liegen aktuell noch keine Dokumente.";
  }

  if (node.kind === "moves-root") {
    return "Für diesen Kunden sind noch keine Umzugsordner vorhanden.";
  }

  if (node.kind === "move-documents") {
    return "In diesem Umzugsordner liegen aktuell noch keine umzugsbezogenen Dokumente.";
  }

  return "Dieser Ordner ist aktuell leer.";
}

function getPathSegments(
  customer: DocumentLibraryCustomerRecord | null,
  node: SelectedNode,
  move: DocumentLibraryMoveRecord | null,
) {
  if (!node || node.kind === "root") {
    return [];
  }

  if (!customer) {
    return [];
  }

  const customerNode = { kind: "customer", customerId: customer.id } as const;
  const movesRootNode = { kind: "moves-root", customerId: customer.id } as const;
  const segments: Array<{ label: string; node: Exclude<SelectedNode, null> }> = [
    {
      label: customer.customerNumber,
      node: customerNode,
    },
  ];

  if (node.kind === "customer-documents") {
    segments.push({
      label: "Kundendokumente",
      node: { kind: "customer-documents", customerId: customer.id },
    });
  }

  if (node.kind === "moves-root") {
    segments.push({
      label: "Umzüge",
      node: movesRootNode,
    });
  }

  if (node.kind === "move" || node.kind === "move-documents") {
    segments.push({
      label: "Umzüge",
      node: movesRootNode,
    });
    segments.push({
      label: move?.moveNumber ?? "Umzug",
      node: { kind: "move", customerId: customer.id, moveId: move?.id ?? node.moveId },
    });
  }

  if (node.kind === "move-documents") {
    segments.push({
      label: "Umzugsbezogen",
      node: { kind: "move-documents", customerId: customer.id, moveId: node.moveId },
    });
  }

  return segments;
}

function getActivePath(
  customer: DocumentLibraryCustomerRecord | null,
  node: SelectedNode,
  move: DocumentLibraryMoveRecord | null,
) {
  if (node?.kind === "root") {
    return "Kunden";
  }

  const segments = getPathSegments(customer, node, move).map((segment) => segment.label);

  return segments.length === 0 ? "Keine Auswahl" : segments.join(" / ");
}

function getCustomerFolderDetail(customer: DocumentLibraryCustomerRecord, folderFilter: FolderFilter) {
  if (folderFilter === "customer") {
    return `${customer.documents.length} Kundendokumente`;
  }

  if (folderFilter === "moves") {
    return `${customer.moves.length} Umzugsordner`;
  }

  return `${customer.documents.length} Dokumente | ${customer.moves.length} Umzüge`;
}

function getCustomerFolderUpdatedLabel(customer: DocumentLibraryCustomerRecord) {
  return customer.documents[0]?.updatedAt ?? customer.moves[0]?.scheduleLabel ?? "Leer";
}

function getExplorerItems(
  customers: DocumentLibraryCustomerRecord[],
  customer: DocumentLibraryCustomerRecord | null,
  node: SelectedNode,
  move: DocumentLibraryMoveRecord | null,
  folderFilter: FolderFilter,
): ExplorerItem[] {
  if (!node) {
    return [];
  }

  if (node.kind === "root") {
    return customers.map((customerEntry) => ({
      badge: customerEntry.customerNumber,
      detail: getCustomerFolderDetail(customerEntry, folderFilter),
      id: customerEntry.id,
      kind: "folder",
      name: getCustomerDisplayName(customerEntry),
      subtitle: [customerEntry.customerNumber, customerEntry.city || "Ort offen"].join(" | "),
      targetNode: { kind: "customer", customerId: customerEntry.id },
      typeLabel: "Kundenordner",
      updatedLabel: getCustomerFolderUpdatedLabel(customerEntry),
    }));
  }

  if (!customer) {
    return [];
  }

  if (node.kind === "customer") {
    const items: ExplorerItem[] = [];

    if (folderFilter !== "moves") {
      items.push({
        badge: `${customer.documents.length}`,
        detail: customer.documents.length > 0 ? `${customer.documents.length} Dateien` : "Noch keine Unterlagen",
        id: `${customer.id}-customer-documents`,
        kind: "folder",
        name: "Kundendokumente",
        subtitle: "Allgemeine Unterlagen zum Kunden",
        targetNode: { kind: "customer-documents", customerId: customer.id },
        typeLabel: "Ordner",
        updatedLabel: customer.documents[0]?.updatedAt ?? "Leer",
      });
    }

    if (folderFilter !== "customer") {
      items.push({
        badge: `${customer.moves.length}`,
        detail: customer.moves.length > 0 ? `${customer.moves.length} Umzugsordner` : "Noch keine Umzüge",
        id: `${customer.id}-moves-root`,
        kind: "folder",
        name: "Umzüge",
        subtitle: "Alle umzugsbezogenen Unterordner",
        targetNode: { kind: "moves-root", customerId: customer.id },
        typeLabel: "Ordner",
        updatedLabel: customer.moves[0]?.scheduleLabel ?? "Leer",
      });
    }

    return items;
  }

  if (node.kind === "customer-documents") {
    return customer.documents.map((document) => ({
      badge: document.fileName || "Datei",
      detail: "Allgemein Kunde",
      fileName: document.fileName,
      id: document.id,
      kind: "document",
      name: document.title,
      openUrl: document.fileUrl,
      relativePath: document.id,
      subtitle: document.fileName,
      typeLabel: "Datei",
      updatedLabel: document.updatedAt,
    }));
  }

  if (node.kind === "moves-root") {
    return customer.moves.map((moveEntry) => ({
      badge: getMoveStatusLabel(moveEntry.status),
      detail: moveEntry.routeLabel,
      id: moveEntry.id,
      kind: "folder",
      name: moveEntry.moveNumber,
      subtitle: moveEntry.scheduleLabel,
      targetNode: { kind: "move", customerId: customer.id, moveId: moveEntry.id },
      typeLabel: "Ordner",
      updatedLabel: moveEntry.scheduleLabel,
    }));
  }

  if (node.kind === "move" && move) {
    return [
      {
        badge: `${move.documentCount}`,
        detail: move.documentCount > 0 ? `${move.documentCount} Dokumente` : "Noch keine Einträge",
        id: `${move.id}-move-documents`,
        kind: "folder",
        name: "Umzugsbezogen",
        subtitle: "Dokumente dieses Umzugs",
        targetNode: { kind: "move-documents", customerId: customer.id, moveId: move.id },
        typeLabel: "Ordner",
        updatedLabel: move.scheduleLabel,
      },
    ];
  }

  if (node.kind === "move-documents" && move) {
    return move.documents.map((document) => ({
      badge: document.fileName || "Datei",
      detail: "Umzugsbezogen",
      fileName: document.fileName,
      id: document.id,
      kind: "document",
      name: document.title,
      openUrl: document.fileUrl,
      relativePath: document.id,
      subtitle: document.fileName,
      typeLabel: "Datei",
      updatedLabel: document.updatedAt,
    }));
  }

  return [];
}

function getViewModeButtonClass(lightMode: boolean, active: boolean) {
  if (active) {
    return lightMode
      ? "bg-[#FF007F] text-white shadow-lg shadow-[#FF007F]/20"
      : "bg-[#FF007F] text-white shadow-lg shadow-[#FF007F]/30";
  }

  return lightMode
    ? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-200"
    : "bg-zinc-900 text-zinc-200 ring-1 ring-white/10 hover:bg-zinc-800";
}

function activateExplorerItem(
  item: ExplorerItem,
  onOpenNode: (node: Exclude<SelectedNode, null>) => void,
  onOpenDocument: (targetUrl: string) => void,
) {
  if (item.targetNode) {
    onOpenNode(item.targetNode);
    return;
  }

  if (item.openUrl) {
    onOpenDocument(item.openUrl);
  }
}

function ExplorerListRow({
  item,
  lightMode,
  onDeleteFile,
  onOpenDocument,
  onOpenNode,
  onRenameFile,
  onSendMail,
}: {
  item: ExplorerItem;
  lightMode: boolean;
  onDeleteFile: (item: ExplorerItem) => void;
  onOpenDocument: (targetUrl: string) => void;
  onOpenNode: (node: Exclude<SelectedNode, null>) => void;
  onRenameFile: (item: ExplorerItem) => void;
  onSendMail: (item: ExplorerItem) => void;
}) {
  const chrome = getPageChrome(lightMode);
  const rowClass = `grid items-start gap-3 px-4 py-3 text-left transition md:grid-cols-[minmax(0,2.1fr)_150px_minmax(0,1.2fr)_140px_56px] ${
    lightMode ? "border-zinc-200 hover:bg-zinc-50" : "border-white/10 hover:bg-zinc-950"
  }`;
  const targetNode = item.targetNode;
  const openUrl = item.openUrl;
  const interactive = Boolean(targetNode || openUrl);
  const content = (
    <>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span className={item.kind === "folder" ? "text-[#FF007F]" : lightMode ? "text-zinc-500" : "text-zinc-400"}>
            {item.kind === "folder" ? <FolderIcon /> : <FileIcon />}
          </span>
          <div className="min-w-0">
            <p className={`truncate text-sm font-medium ${chrome.bodyText}`}>{item.name}</p>
            <p className={`truncate text-xs ${chrome.mutedText}`}>{item.subtitle}</p>
          </div>
        </div>
      </div>
      <div className={`text-sm ${chrome.mutedText}`}>{item.typeLabel}</div>
      <div className="min-w-0">
        <p className={`truncate text-sm ${chrome.mutedText}`}>{item.detail}</p>
        {item.badge ? <p className={`truncate text-xs ${chrome.overline}`}>{item.badge}</p> : null}
      </div>
      <div className={`text-sm ${chrome.mutedText}`}>{item.updatedLabel}</div>
      <div className="flex justify-end">
        <details
          className="relative"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <summary
            className={`list-none rounded-lg p-2 transition ${
              lightMode ? "text-zinc-500 hover:bg-zinc-100" : "text-zinc-300 hover:bg-zinc-800"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <DotsIcon />
          </summary>
          <div
            className={`absolute right-0 top-10 z-20 w-48 rounded-xl p-2 shadow-xl ${
              lightMode ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-950 ring-1 ring-white/10"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            {item.openUrl ? (
              <button
                type="button"
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  lightMode ? "text-zinc-800 hover:bg-zinc-100" : "text-zinc-100 hover:bg-zinc-800"
                }`}
                onClick={() => onOpenDocument(item.openUrl!)}
              >
                Öffnen
              </button>
            ) : null}
            <button
              type="button"
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                item.kind === "document" && item.relativePath
                  ? lightMode
                    ? "text-zinc-800 hover:bg-zinc-100"
                    : "text-zinc-100 hover:bg-zinc-800"
                  : lightMode
                    ? "cursor-not-allowed text-zinc-400"
                    : "cursor-not-allowed text-zinc-500"
              }`}
              disabled={item.kind !== "document" || !item.relativePath}
              onClick={() => onSendMail(item)}
            >
              Per Mail senden
            </button>
            <button
              type="button"
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                item.kind === "document" && item.relativePath
                  ? lightMode
                    ? "text-zinc-800 hover:bg-zinc-100"
                    : "text-zinc-100 hover:bg-zinc-800"
                  : lightMode
                    ? "cursor-not-allowed text-zinc-400"
                    : "cursor-not-allowed text-zinc-500"
              }`}
              disabled={item.kind !== "document" || !item.relativePath}
              title={item.kind !== "document" ? "Ordner können hier nicht umbenannt werden." : undefined}
              onClick={() => onRenameFile(item)}
            >
              Umbenennen
            </button>
            <button
              type="button"
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                item.kind === "document" && item.relativePath
                  ? lightMode
                    ? "text-red-700 hover:bg-red-50"
                    : "text-red-200 hover:bg-red-950/40"
                  : lightMode
                    ? "cursor-not-allowed text-zinc-400"
                    : "cursor-not-allowed text-zinc-500"
              }`}
              disabled={item.kind !== "document" || !item.relativePath}
              title={item.kind !== "document" ? "Ordner können hier nicht gelöscht werden." : undefined}
              onClick={() => onDeleteFile(item)}
            >
              Löschen
            </button>
          </div>
        </details>
      </div>
    </>
  );

  if (interactive) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (targetNode) {
            onOpenNode(targetNode);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (targetNode) {
              onOpenNode(targetNode);
            }
          }
        }}
        onDoubleClick={() => activateExplorerItem(item, onOpenNode, onOpenDocument)}
        className={rowClass}
      >
        {content}
      </div>
    );
  }

  return <div className={rowClass}>{content}</div>;
}

function ExplorerTile({
  item,
  lightMode,
  onDeleteFile,
  onOpenDocument,
  onOpenNode,
  onRenameFile,
  onSendMail,
}: {
  item: ExplorerItem;
  lightMode: boolean;
  onDeleteFile: (item: ExplorerItem) => void;
  onOpenDocument: (targetUrl: string) => void;
  onOpenNode: (node: Exclude<SelectedNode, null>) => void;
  onRenameFile: (item: ExplorerItem) => void;
  onSendMail: (item: ExplorerItem) => void;
}) {
  const chrome = getPageChrome(lightMode);
  const interactive = Boolean(item.targetNode || item.openUrl);
  const tileClass = `rounded-2xl p-4 text-left transition ${
    lightMode
      ? "bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 hover:ring-[#FF007F]/25"
      : "bg-zinc-900 ring-1 ring-white/10 hover:bg-zinc-950 hover:ring-[#FF007F]/25"
  }`;

  if (!interactive) {
    return (
      <div className={tileClass}>
        <div className="flex items-start justify-between gap-3">
          <span className={item.kind === "folder" ? "text-[#FF007F]" : lightMode ? "text-zinc-500" : "text-zinc-400"}>
            {item.kind === "folder" ? <FolderIcon className="h-8 w-8" /> : <FileIcon className="h-8 w-8" />}
          </span>
          <span className={chrome.neutralChip}>{item.typeLabel}</span>
        </div>
        <p className={`mt-4 truncate text-sm font-semibold ${chrome.bodyText}`}>{item.name}</p>
        <p className={`mt-1 truncate text-xs ${chrome.mutedText}`}>{item.subtitle}</p>
        <p className={`mt-4 text-sm ${chrome.mutedText}`}>{item.detail}</p>
        <p className={`mt-2 text-xs ${chrome.overline}`}>{item.updatedLabel}</p>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onDoubleClick={() => activateExplorerItem(item, onOpenNode, onOpenDocument)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateExplorerItem(item, onOpenNode, onOpenDocument);
        }
      }}
      className={`${tileClass} cursor-default outline-none focus-visible:ring-2 focus-visible:ring-[#FF007F]/35`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={item.kind === "folder" ? "text-[#FF007F]" : lightMode ? "text-zinc-500" : "text-zinc-400"}>
          {item.kind === "folder" ? <FolderIcon className="h-8 w-8" /> : <FileIcon className="h-8 w-8" />}
        </span>
        <div className="flex items-center gap-2">
          <span className={chrome.neutralChip}>{item.typeLabel}</span>
          <details
            className="relative"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <summary
              className={`list-none rounded-lg p-2 transition ${
                lightMode ? "text-zinc-500 hover:bg-zinc-100" : "text-zinc-300 hover:bg-zinc-800"
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              <DotsIcon />
            </summary>
            <div
              className={`absolute right-0 top-10 z-20 w-48 rounded-xl p-2 shadow-xl ${
                lightMode ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-950 ring-1 ring-white/10"
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              {item.openUrl ? (
                <button
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    lightMode ? "text-zinc-800 hover:bg-zinc-100" : "text-zinc-100 hover:bg-zinc-800"
                  }`}
                  onClick={() => onOpenDocument(item.openUrl!)}
                >
                  Öffnen
                </button>
              ) : null}
              <button
                type="button"
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  item.kind === "document" && item.relativePath
                    ? lightMode
                      ? "text-zinc-800 hover:bg-zinc-100"
                      : "text-zinc-100 hover:bg-zinc-800"
                    : lightMode
                      ? "cursor-not-allowed text-zinc-400"
                      : "cursor-not-allowed text-zinc-500"
                }`}
                disabled={item.kind !== "document" || !item.relativePath}
                onClick={() => onSendMail(item)}
              >
                Per Mail senden
              </button>
              <button
                type="button"
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  item.kind === "document" && item.relativePath
                    ? lightMode
                      ? "text-zinc-800 hover:bg-zinc-100"
                      : "text-zinc-100 hover:bg-zinc-800"
                    : lightMode
                      ? "cursor-not-allowed text-zinc-400"
                      : "cursor-not-allowed text-zinc-500"
                }`}
                disabled={item.kind !== "document" || !item.relativePath}
                title={item.kind !== "document" ? "Ordner können hier nicht umbenannt werden." : undefined}
                onClick={() => onRenameFile(item)}
              >
                Umbenennen
              </button>
              <button
                type="button"
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  item.kind === "document" && item.relativePath
                    ? lightMode
                      ? "text-red-700 hover:bg-red-50"
                      : "text-red-200 hover:bg-red-950/40"
                    : lightMode
                      ? "cursor-not-allowed text-zinc-400"
                      : "cursor-not-allowed text-zinc-500"
                }`}
                disabled={item.kind !== "document" || !item.relativePath}
                title={item.kind !== "document" ? "Ordner können hier nicht gelöscht werden." : undefined}
                onClick={() => onDeleteFile(item)}
              >
                Löschen
              </button>
            </div>
          </details>
        </div>
      </div>
      <p className={`mt-4 truncate text-sm font-semibold ${chrome.bodyText}`}>{item.name}</p>
      <p className={`mt-1 truncate text-xs ${chrome.mutedText}`}>{item.subtitle}</p>
      <p className={`mt-4 text-sm ${chrome.mutedText}`}>{item.detail}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className={`truncate text-xs ${chrome.overline}`}>{item.updatedLabel}</p>
        {item.badge ? <span className={chrome.chip}>{item.badge}</span> : null}
      </div>
    </div>
  );
}

function ExplorerContentPane({
  activePath,
  items,
  lightMode,
  onDeleteFile,
  onOpenDocument,
  onOpenNode,
  onRenameFile,
  onSendMail,
  selectedCustomer,
  selectedMove,
  selectedNode,
  viewMode,
}: {
  activePath: string;
  items: ExplorerItem[];
  lightMode: boolean;
  onDeleteFile: (item: ExplorerItem) => void;
  onOpenDocument: (targetUrl: string) => void;
  onOpenNode: (node: Exclude<SelectedNode, null>) => void;
  onRenameFile: (item: ExplorerItem) => void;
  onSendMail: (items: ExplorerItem[]) => void;
  selectedCustomer: DocumentLibraryCustomerRecord | null;
  selectedMove: DocumentLibraryMoveRecord | null;
  selectedNode: SelectedNode;
  viewMode: ExplorerViewMode;
}) {
  const chrome = getPageChrome(lightMode);
  const title = getSelectedNodeTitle(selectedCustomer, selectedNode, selectedMove);
  const subtitle = getSelectedNodeSubtitle(selectedCustomer, selectedNode, selectedMove);
  const isTileView = viewMode === "tiles";
  const documentItems = useMemo(() => items.filter((item) => item.kind === "document" && item.relativePath), [items]);

  return (
    <section className={`flex min-h-[620px] flex-col ${lightMode ? "bg-white" : "bg-zinc-900"}`}>
      {isTileView ? (
        <div className={`border-b px-4 py-3 ${lightMode ? "border-zinc-200 bg-zinc-50" : "border-white/10 bg-zinc-950"}`}>
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>Kachelansicht</p>
              <p className={`mt-1 text-sm ${chrome.bodyText}`}>{title}</p>
              <p className={`mt-1 text-sm ${chrome.mutedText}`}>Doppelklick öffnet Ordner oder Dokument. {items.length} Einträge im aktuellen Pfad.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {documentItems.length > 0 ? (
                <button type="button" className={chrome.secondaryButton} onClick={() => onSendMail(documentItems)}>
                  Alle Dokumente mailen
                </button>
              ) : null}
              <div className={`${chrome.compactSurfaceMuted} text-sm`}>{activePath}</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={`border-b p-4 ${lightMode ? "border-zinc-200" : "border-white/10"}`}>
            <p className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>Geöffneter Ordner</p>
            <h2 className={`mt-2 text-xl font-semibold ${chrome.bodyText}`}>{title}</h2>
            <p className={`mt-1 text-sm ${chrome.mutedText}`}>{subtitle}</p>
            <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${lightMode ? "bg-zinc-50 ring-1 ring-zinc-200" : "bg-zinc-950 ring-1 ring-white/10"}`}>
              {activePath}
            </div>
            {documentItems.length > 0 ? (
              <div className="mt-3 flex justify-end">
                <button type="button" className={chrome.secondaryButton} onClick={() => onSendMail(documentItems)}>
                  Alle Dokumente mailen
                </button>
              </div>
            ) : null}
          </div>

          <div className={`hidden border-b px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] md:grid md:grid-cols-[minmax(0,2.1fr)_150px_minmax(0,1.2fr)_140px_56px] ${lightMode ? "border-zinc-200 text-zinc-500" : "border-white/10 text-zinc-400"}`}>
            <span>Name</span>
            <span>Typ</span>
            <span>Details</span>
            <span>Aktualisiert</span>
            <span className="text-right">Aktion</span>
          </div>
        </>
      )}

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className={`m-4 ${chrome.emptyState}`}>{getEmptyStateMessage(selectedNode)}</div>
        ) : isTileView ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <ExplorerTile
                key={item.id}
                item={item}
                lightMode={lightMode}
                onDeleteFile={onDeleteFile}
                onOpenDocument={onOpenDocument}
                onOpenNode={onOpenNode}
                onRenameFile={onRenameFile}
                onSendMail={(target) => onSendMail([target])}
              />
            ))}
          </div>
        ) : (
          items.map((item) => (
            <ExplorerListRow
              key={item.id}
              item={item}
              lightMode={lightMode}
              onDeleteFile={onDeleteFile}
              onOpenDocument={onOpenDocument}
              onOpenNode={onOpenNode}
              onRenameFile={onRenameFile}
              onSendMail={(target) => onSendMail([target])}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default function DocumentsPageClient({ initialCustomers }: { initialCustomers: DocumentLibraryCustomerRecord[] }) {
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);
  const rootNode = { kind: "root" } as const;
  const [customers, setCustomers] = useState(initialCustomers);
  const [searchTerm, setSearchTerm] = useState("");
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [preferredSelectedNode, setPreferredSelectedNode] = useState<SelectedNode>(() =>
    getInitialSelectedNode(initialCustomers, "all"),
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState("");
  const [uploadStatusMessage, setUploadStatusMessage] = useState("");
  const [mailItems, setMailItems] = useState<ExplorerItem[]>([]);
  const [mailTo, setMailTo] = useState("");
  const [mailPassword, setMailPassword] = useState("");
  const [mailMessage, setMailMessage] = useState("Anbei erhalten Sie die angeforderten Dokumente.");
  const [mailErrorMessage, setMailErrorMessage] = useState("");
  const [mailStatusMessage, setMailStatusMessage] = useState("");
  const [mailModalOpen, setMailModalOpen] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState(false);
  const viewMode = useSyncExternalStore<ExplorerViewMode>(
    subscribeToExplorerViewMode,
    getStoredExplorerViewMode,
    () => "details",
  );
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
  const searchIsDeferred = deferredSearchTerm !== searchTerm;

  const customerDocumentCount = useMemo(
    () => customers.reduce((sum, customer) => sum + customer.documents.length, 0),
    [customers],
  );
  const moveFolderCount = useMemo(
    () => customers.reduce((sum, customer) => sum + customer.moves.length, 0),
    [customers],
  );
  const customersWithDocuments = useMemo(
    () => customers.filter((customer) => customer.documents.length > 0).length,
    [customers],
  );

  const filteredCustomers = useMemo(
    () =>
      customers.filter((customer) => {
        const searchText = [
          customer.customerNumber,
          customer.company,
          customer.firstName,
          customer.lastName,
          customer.address,
          customer.postalCode,
          customer.city,
          customer.phone,
          customer.email,
          ...customer.documents.map((document) => `${document.title} ${document.fileName}`),
          ...customer.moves.map(
            (move) =>
              `${move.moveNumber} ${move.routeLabel} ${move.scheduleLabel} ${move.documents
                .map((document) => `${document.title} ${document.fileName}`)
                .join(" ")}`,
          ),
        ]
          .join(" ")
          .toLowerCase();

        return normalizedSearch.length === 0 || searchText.includes(normalizedSearch);
      }),
    [customers, normalizedSearch],
  );

  const selectedNode = useMemo(
    () =>
      isNodeVisible(preferredSelectedNode, filteredCustomers, folderFilter)
        ? preferredSelectedNode
        : getInitialSelectedNode(filteredCustomers, folderFilter),
    [filteredCustomers, folderFilter, preferredSelectedNode],
  );

  const selectedCustomer = useMemo(
    () =>
      selectedNode && selectedNode.kind !== "root"
        ? filteredCustomers.find((customer) => customer.id === selectedNode.customerId) ?? null
        : null,
    [filteredCustomers, selectedNode],
  );

  const selectedMove = useMemo(() => {
    if (!selectedCustomer || !selectedNode || (selectedNode.kind !== "move" && selectedNode.kind !== "move-documents")) {
      return null;
    }

    return selectedCustomer.moves.find((move) => move.id === selectedNode.moveId) ?? null;
  }, [selectedCustomer, selectedNode]);

  const activePath = getActivePath(selectedCustomer, selectedNode, selectedMove);
  const pathSegments = getPathSegments(selectedCustomer, selectedNode, selectedMove);
  const explorerItems = useMemo(
    () => getExplorerItems(filteredCustomers, selectedCustomer, selectedNode, selectedMove, folderFilter),
    [filteredCustomers, folderFilter, selectedCustomer, selectedMove, selectedNode],
  );

  const uploadTarget =
    selectedCustomer && selectedNode?.kind === "customer-documents"
      ? { scope: "customer" as const, customerNumber: selectedCustomer.customerNumber }
      : selectedCustomer && selectedMove && selectedNode?.kind === "move-documents"
        ? { scope: "move" as const, customerNumber: selectedCustomer.customerNumber, moveNumber: selectedMove.moveNumber }
        : null;

  async function refreshLibrary() {
    const response = await fetch("/api/documents/library", { cache: "no-store" });
    const payload = (await readJsonResponse<{ customers?: DocumentLibraryCustomerRecord[]; message?: string }>(response)) ?? {};

    if (!response.ok || !payload.customers) {
      throw new Error(payload.message ?? "Dokumentenliste konnte nicht aktualisiert werden.");
    }

    setCustomers(payload.customers);
  }

  useEffect(() => {
    const handleRefresh = () => {
      void refreshLibrary().catch(() => {
        // Optional: wenn die API gerade nicht erreichbar ist, bleibt die letzte Ansicht stehen.
      });
    };

    window.addEventListener(documentsLibraryRefreshEventName, handleRefresh);
    return () => window.removeEventListener(documentsLibraryRefreshEventName, handleRefresh);
  }, []);

  async function uploadFiles(fileList: FileList | null) {
    if (!uploadTarget) {
      return;
    }

    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadErrorMessage("");
    setUploadStatusMessage(`${files.length} Datei${files.length === 1 ? "" : "en"} werden hochgeladen...`);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.set("scope", uploadTarget.scope);
        formData.set("customerNumber", uploadTarget.customerNumber);
        if (uploadTarget.scope === "move") {
          formData.set("moveNumber", uploadTarget.moveNumber);
        }
        formData.set("file", file);

        const response = await fetch("/api/documents/upload", { method: "POST", body: formData });
        const payload = (await readJsonResponse<{ message?: string }>(response)) ?? {};

        if (!response.ok) {
          throw new Error(payload.message ?? "Upload fehlgeschlagen.");
        }
      }

      setUploadStatusMessage("Upload abgeschlossen. Aktualisiere Ansicht...");
      await refreshLibrary();
      setUploadStatusMessage("Upload abgeschlossen.");
    } catch (error) {
      setUploadErrorMessage(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
      setUploadStatusMessage("");
    } finally {
      setIsUploading(false);
    }
  }

  async function renameFile(item: ExplorerItem) {
    if (!item.relativePath) {
      return;
    }

    const currentFileName = item.fileName || item.subtitle || "Dokument";
    const nextFileName = window.prompt("Neuer Dateiname:", currentFileName);
    if (!nextFileName) {
      return;
    }

    setUploadErrorMessage("");
    setUploadStatusMessage("Datei wird umbenannt...");

    try {
      const response = await fetch("/api/documents/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: item.relativePath, nextFileName }),
      });
      const payload = (await readJsonResponse<{ message?: string }>(response)) ?? {};

      if (!response.ok) {
        throw new Error(payload.message ?? "Umbenennen fehlgeschlagen.");
      }

      await refreshLibrary();
      setUploadStatusMessage(payload.message ?? "Datei wurde umbenannt.");
    } catch (error) {
      setUploadErrorMessage(error instanceof Error ? error.message : "Umbenennen fehlgeschlagen.");
      setUploadStatusMessage("");
    }
  }

  async function deleteFile(item: ExplorerItem) {
    if (!item.relativePath) {
      return;
    }

    const confirmed = window.confirm(`Datei "${item.fileName || item.subtitle || item.name}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }

    setUploadErrorMessage("");
    setUploadStatusMessage("Datei wird gelöscht...");

    try {
      const response = await fetch("/api/documents/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: item.relativePath }),
      });
      const payload = (await readJsonResponse<{ message?: string }>(response)) ?? {};

      if (!response.ok) {
        throw new Error(payload.message ?? "Löschen fehlgeschlagen.");
      }

      await refreshLibrary();
      setUploadStatusMessage(payload.message ?? "Datei wurde gelöscht.");
    } catch (error) {
      setUploadErrorMessage(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
      setUploadStatusMessage("");
    }
  }

  function openMailModal(nextItems: ExplorerItem[]) {
    const documents = nextItems.filter((item) => item.kind === "document" && item.relativePath);
    if (documents.length === 0) {
      return;
    }

    setMailItems(documents);
    setMailTo(selectedCustomer?.email ?? mailTo);
    setMailPassword(selectedCustomer?.postalCode ?? mailPassword);
    setMailErrorMessage("");
    setMailStatusMessage("");
    setMailModalOpen(true);
  }

  async function sendDocumentsByMail() {
    const paths = mailItems.map((item) => item.relativePath).filter(Boolean) as string[];
    if (paths.length === 0) {
      return;
    }

    setIsSendingMail(true);
    setMailErrorMessage("");
    setMailStatusMessage("Versendet Dokumente...");

    try {
      const response = await fetch("/api/documents/send-mail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: mailTo,
          password: mailPassword,
          message: mailMessage,
          paths,
        }),
      });
      const payload = (await readJsonResponse<{ message?: string }>(response)) ?? {};
      if (!response.ok) {
        throw new Error(payload.message ?? "Dokumente konnten nicht versendet werden.");
      }

      setMailStatusMessage(payload.message ?? "Dokumente wurden versendet.");
      setMailModalOpen(false);
      setUploadStatusMessage(payload.message ?? "Dokumente wurden versendet.");
    } catch (error) {
      setMailErrorMessage(error instanceof Error ? error.message : "Dokumente konnten nicht versendet werden.");
      setMailStatusMessage("");
    } finally {
      setIsSendingMail(false);
    }
  }

  function openDocument(targetUrl: string) {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Dokumentendatenbank</p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className={chrome.heroTitle}>Dokumente</h1>
            <p className={chrome.heroText}>
              Explorer ohne Seiten-Navigation. Der Einstieg ist immer im Root `Kunden`, von dort öffnest du alle Ordner
              direkt im Inhaltsbereich.
            </p>
          </div>

          <div className={chrome.heroAccentCard}>
            <p className={chrome.heroAccentEyebrow}>Geöffnet</p>
            <p className={chrome.heroAccentValue}>{getSelectedNodeTitle(selectedCustomer, selectedNode, selectedMove)}</p>
            <p className={chrome.heroAccentMeta}>{activePath}</p>
          </div>
        </div>
      </header>

      <div className={chrome.statsGrid}>
        <article className={chrome.statAccentCard}>
          <p className={chrome.statLabel}>Kundenordner</p>
          <p className={chrome.statAccentValue}>{customers.length}</p>
          <p className={chrome.statHint}>oberste Ebene</p>
        </article>
        <article className={chrome.statCard}>
          <p className={chrome.statLabel}>Kundendokumente</p>
          <p className={chrome.statValue}>{customerDocumentCount}</p>
          <p className={chrome.statHint}>echte Dateien im Kundenordner</p>
        </article>
        <article className={chrome.statCard}>
          <p className={chrome.statLabel}>Umzugsordner</p>
          <p className={chrome.statValue}>{moveFolderCount}</p>
          <p className={chrome.statHint}>unter Kunden abgelegt</p>
        </article>
        <article className={chrome.statCard}>
          <p className={chrome.statLabel}>Kunden mit Dateien</p>
          <p className={chrome.statValue}>{customersWithDocuments}</p>
          <p className={chrome.statHint}>mindestens eine Datei</p>
        </article>
      </div>

      <section className={chrome.panelRoomy}>
        <div
          className={`overflow-hidden rounded-2xl ring-1 ${
            lightMode ? "bg-zinc-100 ring-zinc-200" : "bg-zinc-950 ring-white/10"
          }`}
        >
          <div className={`border-b p-3 ${lightMode ? "border-zinc-200 bg-white" : "border-white/10 bg-zinc-900"}`}>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <p className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>Pfad</p>
                <div
                  className={`mt-2 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 ${
                    lightMode ? "bg-zinc-50 ring-1 ring-zinc-200" : "bg-zinc-950 ring-1 ring-white/10"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPreferredSelectedNode(rootNode)}
                    className={`rounded-lg px-2.5 py-1 text-sm transition ${
                      isNodeSelected(selectedNode, rootNode)
                        ? "bg-[#FF007F] text-white"
                        : lightMode
                          ? "bg-[#FF007F]/10 text-[#c00062] hover:bg-[#FF007F]/15"
                          : "bg-[#FF007F]/15 text-[#ff8cc5] hover:bg-[#FF007F]/20"
                    }`}
                  >
                    Kunden
                  </button>
                  {pathSegments.map((segment, index) => (
                    <div key={`${segment.label}-${index}`} className="flex items-center gap-2">
                      <ChevronRightIcon className={lightMode ? "text-zinc-400" : "text-zinc-500"} />
                      <button
                        type="button"
                        onClick={() => setPreferredSelectedNode(segment.node)}
                        title={
                          segment.node.kind === "customer" && selectedCustomer
                            ? `${selectedCustomer.customerNumber} ${getCustomerDisplayName(selectedCustomer)}`
                            : segment.label
                        }
                        className={`rounded-lg px-2.5 py-1 text-sm transition ${
                          isNodeSelected(selectedNode, segment.node)
                            ? "bg-[#FF007F] text-white"
                            : lightMode
                              ? "text-zinc-700 hover:bg-zinc-200"
                              : "text-zinc-200 hover:bg-zinc-800"
                        }`}
                      >
                        {segment.label}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className={chrome.input}
                  placeholder="Suche nach Kunde, Dokument oder Umzug"
                />
                <select
                  value={folderFilter}
                  onChange={(event) => setFolderFilter(event.target.value as FolderFilter)}
                  className={chrome.input}
                >
                  <option value="all">Alle Ordner</option>
                  <option value="customer">Nur Kundendokumente</option>
                  <option value="moves">Nur Umzugsordner</option>
                </select>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>Ansicht</span>
                <button
                  type="button"
                  onClick={() => persistExplorerViewMode("details")}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${getViewModeButtonClass(
                    lightMode,
                    viewMode === "details",
                  )}`}
                >
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => persistExplorerViewMode("tiles")}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${getViewModeButtonClass(
                    lightMode,
                    viewMode === "tiles",
                  )}`}
                >
                  Kacheln
                </button>
                <span className={`${chrome.compactSurfaceMuted} text-sm`}>
                  {viewMode === "tiles" ? "Doppelklick öffnet Ordner und Dokumente." : "Detailansicht mit Spalten."}
                </span>
                {uploadTarget ? (
                  <label
                    className={`ml-auto inline-flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                      lightMode
                        ? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-200"
                        : "bg-zinc-900 text-zinc-200 ring-1 ring-white/10 hover:bg-zinc-800"
                    } ${isUploading ? "opacity-60" : ""}`}
                    title={uploadTarget.scope === "customer" ? "Upload in Kundendokumente" : "Upload in Umzugsbezogen"}
                  >
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(event) => void uploadFiles(event.target.files)}
                      disabled={isUploading}
                    />
                    {isUploading ? "Upload..." : "Upload"}
                  </label>
                ) : null}
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className={`${chrome.subtleInset} text-sm`}>
                {filteredCustomers.length} von {customers.length} Kundenordnern sichtbar
                {searchIsDeferred ? " | Suche wird aktualisiert..." : ""}
              </div>
              <div className={`${chrome.subtleInset} text-sm`}>{activePath}</div>
            </div>

            {uploadStatusMessage ? (
              <div className={`mt-3 ${chrome.subtleInset} text-sm`}>{uploadStatusMessage}</div>
            ) : null}
            {uploadErrorMessage ? (
              <div className={`mt-3 ${chrome.subtleInset} text-sm ${lightMode ? "text-red-700" : "text-red-200"}`}>
                {uploadErrorMessage}
              </div>
            ) : null}
          </div>

          <div>
            <ExplorerContentPane
              activePath={activePath}
              items={explorerItems}
              lightMode={lightMode}
              onDeleteFile={(item) => void deleteFile(item)}
              onOpenDocument={openDocument}
              onOpenNode={setPreferredSelectedNode}
              onRenameFile={(item) => void renameFile(item)}
              onSendMail={(items) => openMailModal(items)}
              selectedCustomer={selectedCustomer}
              selectedMove={selectedMove}
              selectedNode={selectedNode}
              viewMode={viewMode}
            />
          </div>
        </div>
      </section>

      {mailModalOpen ? (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${lightMode ? "bg-zinc-900/30" : "bg-black/60"}`}
          onClick={() => {
            if (!isSendingMail) setMailModalOpen(false);
          }}
        >
          <div
            className={`w-full max-w-xl rounded-2xl p-5 shadow-2xl ${
              lightMode ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-950 ring-1 ring-white/10"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>Dokumente per Mail</p>
                <h2 className={`mt-1 text-lg font-semibold ${chrome.bodyText}`}>{mailItems.length} Datei{mailItems.length === 1 ? "" : "en"} versenden</h2>
                <p className={`mt-1 text-sm ${chrome.mutedText}`}>Die Dateien werden als verschlüsselte ZIPs angehängt.</p>
              </div>
              <button type="button" className={chrome.secondaryButton} onClick={() => setMailModalOpen(false)} disabled={isSendingMail}>
                Schließen
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className={`text-xs ${chrome.overline}`}>Empfänger E-Mail</span>
                <input className={chrome.input} value={mailTo} onChange={(event) => setMailTo(event.target.value)} placeholder="kunde@domain.de" />
              </label>
              <label className="grid gap-1">
                <span className={`text-xs ${chrome.overline}`}>Passwort (Verschlüsselung)</span>
                <input className={chrome.input} value={mailPassword} onChange={(event) => setMailPassword(event.target.value)} placeholder="z.B. PLZ Rechnungsadresse" />
              </label>
              <label className="grid gap-1">
                <span className={`text-xs ${chrome.overline}`}>Nachricht (optional)</span>
                <textarea className={`${chrome.input} min-h-[92px]`} value={mailMessage} onChange={(event) => setMailMessage(event.target.value)} />
              </label>
            </div>

            {mailErrorMessage ? (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${lightMode ? "border-red-200 bg-red-50 text-red-700" : "border-red-900/40 bg-red-950/40 text-red-100"}`}>
                {mailErrorMessage}
              </div>
            ) : null}
            {mailStatusMessage ? (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${lightMode ? "border-zinc-200 bg-zinc-50 text-zinc-700" : "border-white/10 bg-zinc-900 text-zinc-100"}`}>
                {mailStatusMessage}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className={chrome.secondaryButton} onClick={() => setMailModalOpen(false)} disabled={isSendingMail}>
                Abbrechen
              </button>
              <button
                type="button"
                className={chrome.actionButton}
                onClick={() => void sendDocumentsByMail()}
                disabled={isSendingMail || !mailTo.trim() || !mailPassword.trim() || mailItems.length === 0}
              >
                {isSendingMail ? "Sendet..." : "Jetzt senden"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
