"use client";

import type { OrgChartNode } from "@/generated/prisma/client";
import { useMemo, useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";
import SettingsTabs from "@/app/_components/settings-tabs";

type OrganigrammPageClientProps = {
  initialNodes: OrgChartNode[];
};

type NodeFormState = {
  email: string;
  name: string;
  parentId: string;
  phone: string;
  sortOrder: string;
  title: string;
};

function createNodeFormState(node: OrgChartNode | null): NodeFormState {
  return {
    name: node?.name ?? "",
    title: node?.title ?? "",
    email: node?.email ?? "",
    phone: node?.phone ?? "",
    parentId: node?.parentId ?? "",
    sortOrder: String(node?.sortOrder ?? 0),
  };
}

function parseSortOrder(value: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function OrganigrammPageClient({ initialNodes }: OrganigrammPageClientProps) {
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);

  const [nodes, setNodes] = useState<OrgChartNode[]>(initialNodes);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodes[0]?.id ?? null);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;

  const [formState, setFormState] = useState<NodeFormState>(() => createNodeFormState(selectedNode));
  const [savedState, setSavedState] = useState<NodeFormState>(() => createNodeFormState(selectedNode));
  const [statusMessage, setStatusMessage] = useState("Organigramm deiner Organisation pflegen (Abteilungen, Rollen, Ansprechpartner).");
  const [isSaving, setIsSaving] = useState(false);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(savedState),
    [formState, savedState],
  );

  const parentOptions = useMemo(() => {
    const byParent = new Map<string, OrgChartNode[]>();
    nodes.forEach((node) => {
      const key = node.parentId ?? "";
      const entries = byParent.get(key) ?? [];
      entries.push(node);
      byParent.set(key, entries);
    });

    byParent.forEach((entries) => entries.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));

    const flattened: OrgChartNode[] = [];
    function walk(parentId: string | null, depth: number) {
      const key = parentId ?? "";
      const entries = byParent.get(key) ?? [];
      entries.forEach((node) => {
        (node as unknown as { __depth?: number }).__depth = depth;
        flattened.push(node);
        walk(node.id, depth + 1);
      });
    }

    walk(null, 0);
    return flattened;
  }, [nodes]);

  function selectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    const node = nodes.find((entry) => entry.id === nodeId) ?? null;
    const nextState = createNodeFormState(node);
    setFormState(nextState);
    setSavedState(nextState);
    setStatusMessage(node ? `Bearbeite: ${node.name}` : "Knoten auswählen.");
  }

  function updateField(field: keyof NodeFormState, value: string) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function createNode() {
    setIsSaving(true);
    setStatusMessage("Knoten wird angelegt...");

    try {
      const response = await fetch("/api/settings/orgchart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Neuer Eintrag", sortOrder: 0 }),
      });
      const payload = (await response.json()) as { node?: OrgChartNode; message?: string };

      if (!response.ok || !payload.node) {
        throw new Error(payload.message ?? "Knoten konnte nicht angelegt werden.");
      }

      const nextNodes = [payload.node, ...nodes];
      setNodes(nextNodes);
      selectNode(payload.node.id);
      setStatusMessage(payload.message ?? "Knoten wurde angelegt.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Knoten konnte nicht angelegt werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveNode() {
    if (!selectedNode) {
      setStatusMessage("Bitte zuerst einen Knoten auswählen.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Knoten wird gespeichert...");

    try {
      const response = await fetch(`/api/settings/orgchart/${encodeURIComponent(selectedNode.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          title: formState.title,
          email: formState.email,
          phone: formState.phone,
          parentId: formState.parentId || null,
          sortOrder: parseSortOrder(formState.sortOrder),
        }),
      });
      const payload = (await response.json()) as { node?: OrgChartNode; message?: string };

      if (!response.ok || !payload.node) {
        throw new Error(payload.message ?? "Knoten konnte nicht gespeichert werden.");
      }

      setNodes((current) => current.map((node) => (node.id === payload.node?.id ? payload.node : node)));
      const nextState = createNodeFormState(payload.node);
      setFormState(nextState);
      setSavedState(nextState);
      setStatusMessage(payload.message ?? "Knoten wurde gespeichert.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Knoten konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteNode() {
    if (!selectedNode) {
      return;
    }

    const confirmed = window.confirm(`Eintrag "${selectedNode.name}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setStatusMessage("Knoten wird gelöscht...");

    try {
      const response = await fetch(`/api/settings/orgchart/${encodeURIComponent(selectedNode.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Knoten konnte nicht gelöscht werden.");
      }

      const nextNodes = nodes.filter((node) => node.id !== selectedNode.id);
      setNodes(nextNodes);
      const nextSelectedId = nextNodes[0]?.id ?? null;
      setSelectedNodeId(nextSelectedId);
      const nextState = createNodeFormState(nextNodes[0] ?? null);
      setFormState(nextState);
      setSavedState(nextState);
      setStatusMessage(payload.message ?? "Knoten wurde gelöscht.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Knoten konnte nicht gelöscht werden.");
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
            <h1 className={chrome.heroTitle}>Organigramm</h1>
            <p className={chrome.heroText}>Struktur und Ansprechpartner abbilden. Später kann das für Rechte und Workflows genutzt werden.</p>
          </div>
          <div className={chrome.heroAccentCard}>
            <p className={chrome.heroAccentEyebrow}>Einträge</p>
            <p className={chrome.heroAccentValue}>{nodes.length}</p>
            <p className={chrome.heroAccentMeta}>Knoten in der Organisation</p>
          </div>
        </div>
        <SettingsTabs lightMode={lightMode} />
      </header>

      <section className={chrome.panel}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className={chrome.sectionTitle}>Pflege</h2>
            <p className={chrome.sectionText}>Einträge anlegen, verschieben (Parent) und sortieren (Sortierung).</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void createNode()} className={chrome.secondaryButton} disabled={isSaving}>
              Eintrag anlegen
            </button>
            <button type="button" onClick={() => void saveNode()} className={chrome.actionButton} disabled={isSaving || !hasUnsavedChanges}>
              {isSaving ? "Speichert..." : "Speichern"}
            </button>
          </div>
        </div>

        <div className={`mt-4 ${chrome.subtleInset} text-sm`}>{statusMessage}</div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className={chrome.subtlePanel}>
            <div className="flex items-center justify-between">
              <h3 className={chrome.sectionTitle}>Liste</h3>
              <span className={chrome.neutralChip}>{nodes.length}</span>
            </div>

            <div className="mt-4 grid gap-2">
              {parentOptions.length === 0 ? (
                <div className={chrome.emptyState}>Noch keine Einträge.</div>
              ) : (
                parentOptions.map((node) => {
                  const depth = (node as unknown as { __depth?: number }).__depth ?? 0;
                  const active = node.id === selectedNodeId;

                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => selectNode(node.id)}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                        active
                          ? lightMode
                            ? "bg-[#FF007F]/10 ring-1 ring-[#FF007F]/30"
                            : "bg-[#FF007F]/15 ring-1 ring-[#FF007F]/40"
                          : lightMode
                            ? "hover:bg-zinc-100"
                            : "hover:bg-white/5"
                      }`}
                      style={{ paddingLeft: `${12 + depth * 14}px` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>{node.name}</span>
                        <span className={chrome.neutralChip}>{node.sortOrder}</span>
                      </div>
                      <div className={`mt-1 text-xs ${chrome.mutedText}`}>{node.title ?? "Keine Rolle"}</div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <div className={chrome.subtlePanel}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className={chrome.sectionTitle}>Details</h3>
                <p className={chrome.sectionText}>{selectedNode ? `ID: ${selectedNode.id}` : "Bitte links einen Eintrag auswählen."}</p>
              </div>
              <button type="button" onClick={() => void deleteNode()} className={chrome.secondaryButton} disabled={!selectedNode || isSaving}>
                Löschen
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm md:col-span-2">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Name</span>
                <input value={formState.name} onChange={(event) => updateField("name", event.target.value)} className={chrome.input} />
              </label>
              <label className="grid gap-2 text-sm md:col-span-2">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Rolle / Titel</span>
                <input value={formState.title} onChange={(event) => updateField("title", event.target.value)} className={chrome.input} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>E-Mail</span>
                <input value={formState.email} onChange={(event) => updateField("email", event.target.value)} className={chrome.input} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Telefon</span>
                <input value={formState.phone} onChange={(event) => updateField("phone", event.target.value)} className={chrome.input} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Parent</span>
                <select value={formState.parentId} onChange={(event) => updateField("parentId", event.target.value)} className={chrome.input}>
                  <option value="">(Root)</option>
                  {nodes
                    .filter((node) => node.id !== selectedNodeId)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Sortierung</span>
                <input value={formState.sortOrder} onChange={(event) => updateField("sortOrder", event.target.value)} className={chrome.input} inputMode="numeric" />
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
