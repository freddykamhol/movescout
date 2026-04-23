"use client";

import type { User, UserRole } from "@/generated/prisma/client";
import { useMemo, useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";

type BenutzerPageClientProps = {
  initialUsers: User[];
};

type UserFormState = {
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

function createUserFormState(user: User | null): UserFormState {
  return {
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    role: (user?.role ?? "MEMBER") as UserRole,
  };
}

const roleLabels: Record<UserRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Mitarbeiter",
  VIEWER: "Lesen",
};

export default function BenutzerPageClient({ initialUsers }: BenutzerPageClientProps) {
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);

  const [users, setUsers] = useState<User[]>(initialUsers);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUsers[0]?.id ?? null);
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  const [formState, setFormState] = useState<UserFormState>(() => createUserFormState(selectedUser));
  const [savedState, setSavedState] = useState<UserFormState>(() => createUserFormState(selectedUser));
  const [statusMessage, setStatusMessage] = useState("Benutzer deiner Organisation anlegen, bearbeiten und verwalten.");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(formState) !== JSON.stringify(savedState),
    [formState, savedState],
  );

  function selectUser(userId: string) {
    setSelectedUserId(userId);
    const nextUser = users.find((user) => user.id === userId) ?? null;
    const nextState = createUserFormState(nextUser);
    setFormState(nextState);
    setSavedState(nextState);
    setStatusMessage(nextUser ? `Bearbeite Benutzer: ${nextUser.displayName}` : "Benutzer auswählen.");
  }

  function updateField(field: keyof UserFormState, value: string) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value as unknown as UserFormState[typeof field],
    }));
  }

  async function refreshUsers() {
    setIsRefreshing(true);
    try {
      const response = await fetch("/api/settings/users", { cache: "no-store" });
      const payload = (await response.json()) as { users?: User[]; message?: string };

      if (!response.ok || !payload.users) {
        throw new Error(payload.message ?? "Benutzer konnten nicht geladen werden.");
      }

      setUsers(payload.users);
      if (payload.users.length > 0 && !payload.users.some((user) => user.id === selectedUserId)) {
        selectUser(payload.users[0].id);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Benutzer konnten nicht geladen werden.");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function createUser() {
    setIsSaving(true);
    setStatusMessage("Benutzer wird angelegt...");

    try {
      const response = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Neuer Benutzer",
          role: "MEMBER",
        }),
      });
      const payload = (await response.json()) as { user?: User; message?: string };

      if (!response.ok || !payload.user) {
        throw new Error(payload.message ?? "Benutzer konnte nicht angelegt werden.");
      }

      const nextUsers = [payload.user, ...users];
      setUsers(nextUsers);
      selectUser(payload.user.id);
      setStatusMessage(payload.message ?? "Benutzer wurde angelegt.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Benutzer konnte nicht angelegt werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSelectedUser() {
    if (!selectedUser) {
      setStatusMessage("Bitte zuerst einen Benutzer auswählen.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Benutzer wird gespeichert...");

    try {
      const response = await fetch(`/api/settings/users/${encodeURIComponent(selectedUser.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formState),
      });
      const payload = (await response.json()) as { user?: User; message?: string };

      if (!response.ok || !payload.user) {
        throw new Error(payload.message ?? "Benutzer konnte nicht gespeichert werden.");
      }

      setUsers((current) => current.map((user) => (user.id === payload.user?.id ? payload.user : user)));
      const nextState = createUserFormState(payload.user);
      setFormState(nextState);
      setSavedState(nextState);
      setStatusMessage(payload.message ?? "Benutzer wurde gespeichert.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Benutzer konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSelectedUser() {
    if (!selectedUser) {
      return;
    }

    const confirmed = window.confirm(`Benutzer "${selectedUser.displayName}" wirklich löschen?`);
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setStatusMessage("Benutzer wird gelöscht...");

    try {
      const response = await fetch(`/api/settings/users/${encodeURIComponent(selectedUser.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "Benutzer konnte nicht gelöscht werden.");
      }

      const nextUsers = users.filter((user) => user.id !== selectedUser.id);
      setUsers(nextUsers);
      const nextSelected = nextUsers[0]?.id ?? null;
      setSelectedUserId(nextSelected);
      const nextState = createUserFormState(nextUsers[0] ?? null);
      setFormState(nextState);
      setSavedState(nextState);
      setStatusMessage(payload.message ?? "Benutzer wurde gelöscht.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Benutzer konnte nicht gelöscht werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function sendInvite() {
    if (!selectedUser) return;
    setIsSaving(true);
    setStatusMessage("Einladung wird versendet...");
    try {
      const response = await fetch(`/api/settings/users/${encodeURIComponent(selectedUser.id)}/invite`, { method: "POST" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Einladung konnte nicht versendet werden.");
      }
      setStatusMessage(payload.message ?? "Einladung wurde versendet.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Einladung konnte nicht versendet werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function sendPasswordReset() {
    if (!selectedUser) return;
    setIsSaving(true);
    setStatusMessage("Passwort-Reset wird versendet...");
    try {
      const response = await fetch(`/api/settings/users/${encodeURIComponent(selectedUser.id)}/password-reset`, { method: "POST" });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Passwort-Reset konnte nicht versendet werden.");
      }
      setStatusMessage(payload.message ?? "Passwort-Reset wurde versendet.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Passwort-Reset konnte nicht versendet werden.");
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
            <h1 className={chrome.heroTitle}>Benutzer</h1>
            <p className={chrome.heroText}>Verwalte alle Benutzer deiner Organisation. Login ist noch nicht erzwungen, die Struktur ist aber bereits vorbereitet.</p>
          </div>
          <div className={chrome.heroAccentCard}>
            <p className={chrome.heroAccentEyebrow}>Benutzer gesamt</p>
            <p className={chrome.heroAccentValue}>{users.length}</p>
            <p className={chrome.heroAccentMeta}>in dieser Organisation</p>
          </div>
        </div>
      </header>

      <section className={chrome.panel}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className={chrome.sectionTitle}>Verwaltung</h2>
            <p className={chrome.sectionText}>Auswählen, bearbeiten und speichern. Änderungen sind sofort produktiv.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refreshUsers()} className={chrome.secondaryButton} disabled={isRefreshing || isSaving}>
              {isRefreshing ? "Lädt..." : "Aktualisieren"}
            </button>
            <button type="button" onClick={() => void createUser()} className={chrome.secondaryButton} disabled={isSaving}>
              Benutzer anlegen
            </button>
            <button type="button" onClick={() => void saveSelectedUser()} className={chrome.actionButton} disabled={isSaving || !hasUnsavedChanges}>
              {isSaving ? "Speichert..." : "Speichern"}
            </button>
          </div>
        </div>

        <div className={`mt-4 ${chrome.subtleInset} text-sm`}>{statusMessage}</div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className={chrome.subtlePanel}>
            <div className="flex items-center justify-between">
              <h3 className={chrome.sectionTitle}>Liste</h3>
              <span className={chrome.neutralChip}>{users.length}</span>
            </div>

            <div className="mt-4 grid gap-2">
              {users.length === 0 ? (
                <div className={chrome.emptyState}>Noch keine Benutzer angelegt.</div>
              ) : (
                users.map((user) => {
                  const active = user.id === selectedUserId;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => selectUser(user.id)}
                      className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                        active
                          ? lightMode
                            ? "bg-[#FF007F]/10 ring-1 ring-[#FF007F]/30"
                            : "bg-[#FF007F]/15 ring-1 ring-[#FF007F]/40"
                          : lightMode
                            ? "hover:bg-zinc-100"
                            : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium ${lightMode ? "text-zinc-900" : "text-zinc-100"}`}>{user.displayName}</span>
                        <span className={chrome.chip}>{roleLabels[user.role]}</span>
                      </div>
                      <div className={`mt-1 text-xs ${chrome.mutedText}`}>{user.email ?? "Keine E-Mail"}</div>
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
                <p className={chrome.sectionText}>{selectedUser ? `ID: ${selectedUser.id}` : "Bitte links einen Benutzer auswählen."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void sendInvite()}
                  className={chrome.secondaryButton}
                  disabled={!selectedUser || isSaving || !selectedUser.email}
                  title={!selectedUser?.email ? "E-Mail fehlt." : undefined}
                >
                  Einladung senden
                </button>
                <button
                  type="button"
                  onClick={() => void sendPasswordReset()}
                  className={chrome.secondaryButton}
                  disabled={!selectedUser || isSaving || !selectedUser.email}
                  title={!selectedUser?.email ? "E-Mail fehlt." : undefined}
                >
                  Passwort-Reset
                </button>
                <button type="button" onClick={() => void deleteSelectedUser()} className={chrome.secondaryButton} disabled={!selectedUser || isSaving}>
                  Löschen
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm md:col-span-2">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Anzeigename</span>
                <input value={formState.displayName} onChange={(event) => updateField("displayName", event.target.value)} className={chrome.input} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Vorname</span>
                <input value={formState.firstName} onChange={(event) => updateField("firstName", event.target.value)} className={chrome.input} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Nachname</span>
                <input value={formState.lastName} onChange={(event) => updateField("lastName", event.target.value)} className={chrome.input} />
              </label>
              <label className="grid gap-2 text-sm md:col-span-2">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>E-Mail</span>
                <input value={formState.email} onChange={(event) => updateField("email", event.target.value)} className={chrome.input} placeholder="user@firma.de" />
              </label>
              <label className="grid gap-2 text-sm md:col-span-2">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Rolle</span>
                <select
                  value={formState.role}
                  onChange={(event) => updateField("role", event.target.value)}
                  className={chrome.input}
                >
                  {Object.entries(roleLabels).map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
