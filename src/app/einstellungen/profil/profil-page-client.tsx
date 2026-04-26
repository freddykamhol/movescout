"use client";

import type { User, UserRole } from "@/generated/prisma/client";
import { useEffect, useMemo, useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";
import SettingsTabs from "@/app/_components/settings-tabs";

type SessionPayload = {
  organization?: {
    orgKey: string;
    name: string;
  };
  user?: {
    id: string;
    displayName: string;
    email: string | null;
    role: UserRole;
  };
  message?: string;
};

type UserFormState = {
  displayName: string;
  email: string;
  firstName: string;
  lastName: string;
};

function createFormState(user: User | null): UserFormState {
  return {
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
  };
}

export default function ProfilPageClient() {
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);

  const [user, setUser] = useState<User | null>(null);
  const [organizationLabel, setOrganizationLabel] = useState<string>("org_default");
  const [formState, setFormState] = useState<UserFormState>(() => createFormState(null));
  const [savedState, setSavedState] = useState<UserFormState>(() => createFormState(null));
  const [statusMessage, setStatusMessage] = useState("Profil wird geladen...");
  const [isSaving, setIsSaving] = useState(false);

  const hasUnsavedChanges = useMemo(() => JSON.stringify(formState) !== JSON.stringify(savedState), [formState, savedState]);

  useEffect(() => {
    let aborted = false;

    async function load() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const session = (await response.json()) as SessionPayload;

        if (!response.ok || !session.user) {
          throw new Error(session.message ?? "Session konnte nicht geladen werden.");
        }

        if (aborted) {
          return;
        }

        setOrganizationLabel(session.organization?.name ?? session.organization?.orgKey ?? "Organisation");

        const listResponse = await fetch("/api/settings/users", { cache: "no-store" });
        const listPayload = (await listResponse.json()) as { users?: User[]; message?: string };

        if (!listResponse.ok || !listPayload.users) {
          throw new Error(listPayload.message ?? "Benutzer konnten nicht geladen werden.");
        }

        const fullUser = listPayload.users.find((entry) => entry.id === session.user?.id) ?? null;
        setUser(fullUser);
        const nextState = createFormState(fullUser);
        setFormState(nextState);
        setSavedState(nextState);
        setStatusMessage("Profil kann hier angepasst werden.");
      } catch (error) {
        if (!aborted) {
          setStatusMessage(error instanceof Error ? error.message : "Profil konnte nicht geladen werden.");
        }
      }
    }

    void load();

    return () => {
      aborted = true;
    };
  }, []);

  function updateField(field: keyof UserFormState, value: string) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile() {
    if (!user) {
      setStatusMessage("Profil konnte nicht geladen werden.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Profil wird gespeichert...");

    try {
      const response = await fetch(`/api/settings/users/${encodeURIComponent(user.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(formState),
      });
      const payload = (await response.json()) as { user?: User; message?: string };

      if (!response.ok || !payload.user) {
        throw new Error(payload.message ?? "Profil konnte nicht gespeichert werden.");
      }

      setUser(payload.user);
      const nextState = createFormState(payload.user);
      setFormState(nextState);
      setSavedState(nextState);
      setStatusMessage(payload.message ?? "Profil wurde gespeichert.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Profil konnte nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Benutzer</p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className={chrome.heroTitle}>Mein Profil</h1>
            <p className={chrome.heroText}>Eigene Daten bearbeiten. Login ist aktuell noch nicht erzwungen.</p>
          </div>
          <div className={chrome.heroAccentCard}>
            <p className={chrome.heroAccentEyebrow}>Organisation</p>
            <p className={chrome.heroAccentValue}>{organizationLabel}</p>
            <p className={chrome.heroAccentMeta}>{user?.role ? `Rolle: ${user.role}` : "Rolle wird geladen"}</p>
          </div>
        </div>
        <SettingsTabs lightMode={lightMode} />
      </header>

      <section className={chrome.panel}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className={chrome.sectionTitle}>Profil</h2>
            <p className={chrome.sectionText}>Änderungen werden sofort gespeichert.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFormState(savedState)} className={chrome.secondaryButton} disabled={!hasUnsavedChanges || isSaving}>
              Zurücksetzen
            </button>
            <button type="button" onClick={() => void saveProfile()} className={chrome.actionButton} disabled={!hasUnsavedChanges || isSaving}>
              {isSaving ? "Speichert..." : "Speichern"}
            </button>
          </div>
        </div>

        <div className={`mt-4 ${chrome.subtleInset} text-sm`}>{statusMessage}</div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
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
        </div>
      </section>
    </div>
  );
}
