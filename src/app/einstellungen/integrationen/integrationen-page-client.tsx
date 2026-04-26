"use client";

import { useMemo, useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";
import SettingsTabs from "@/app/_components/settings-tabs";
import type { IntegrationSettingsRecord } from "@/lib/integration-settings";

type Props = {
  initialSettings: IntegrationSettingsRecord | null;
};

type FormState = {
  mailFrom: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  clearSmtpPassword: boolean;
  testMailTo: string;

  sftpHost: string;
  sftpPort: string;
  sftpUser: string;
  sftpPassword: string;
  clearSftpPassword: boolean;
  sftpPrivateKey: string;
  clearSftpPrivateKey: boolean;
  sftpRemoteRoot: string;
};

async function readJson<T>(response: Response): Promise<T | null> {
  let rawText = "";
  try {
    rawText = await response.text();
  } catch {
    return null;
  }
  if (!rawText) return null;
  try {
    return JSON.parse(rawText) as T;
  } catch {
    return null;
  }
}

function createFormState(settings: IntegrationSettingsRecord | null): FormState {
  return {
    mailFrom: settings?.mailFrom ?? "",
    smtpHost: settings?.smtpHost ?? "",
    smtpPort: String(settings?.smtpPort ?? 587),
    smtpSecure: settings?.smtpSecure ?? false,
    smtpUser: settings?.smtpUser ?? "",
    smtpPassword: "",
    clearSmtpPassword: false,
    testMailTo: "",

    sftpHost: settings?.sftpHost ?? "",
    sftpPort: String(settings?.sftpPort ?? 22),
    sftpUser: settings?.sftpUser ?? "",
    sftpPassword: "",
    clearSftpPassword: false,
    sftpPrivateKey: "",
    clearSftpPrivateKey: false,
    sftpRemoteRoot: settings?.sftpRemoteRoot ?? "/movescout/documents",
  };
}

export default function IntegrationenPageClient({ initialSettings }: Props) {
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);
  const [settings, setSettings] = useState<IntegrationSettingsRecord | null>(initialSettings);
  const [formState, setFormState] = useState<FormState>(() => createFormState(initialSettings));
  const [savedState, setSavedState] = useState<FormState>(() => createFormState(initialSettings));
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Hier konfigurierst du Mailserver und SFTP pro Organisation. Passwörter/Keys werden verschlüsselt gespeichert.",
  );
  const [mailTestStatus, setMailTestStatus] = useState("");
  const [sftpTestStatus, setSftpTestStatus] = useState("");

  const hasUnsavedChanges = useMemo(() => {
    const comparable = { ...formState, smtpPassword: "", sftpPassword: "", sftpPrivateKey: "" };
    const savedComparable = { ...savedState, smtpPassword: "", sftpPassword: "", sftpPrivateKey: "" };
    return JSON.stringify(comparable) !== JSON.stringify(savedComparable) || Boolean(formState.smtpPassword.trim()) || Boolean(formState.sftpPassword.trim()) || Boolean(formState.sftpPrivateKey.trim());
  }, [formState, savedState]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setFormState((current) => ({ ...current, [field]: value }));
  }

  async function refreshSettings() {
    const response = await fetch("/api/settings/integrations", { method: "GET", cache: "no-store" });
    const payload = (await readJson<{ settings?: IntegrationSettingsRecord | null }>(response)) ?? {};
    setSettings(payload.settings ?? null);
  }

  async function save() {
    setIsSaving(true);
    setStatusMessage("Integrationen werden gespeichert...");
    try {
      const smtpPort = Number.parseInt(formState.smtpPort, 10);
      const sftpPort = Number.parseInt(formState.sftpPort, 10);

      const response = await fetch("/api/settings/integrations", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mailFrom: formState.mailFrom,
          smtpHost: formState.smtpHost,
          smtpPort: Number.isFinite(smtpPort) ? smtpPort : undefined,
          smtpSecure: formState.smtpSecure,
          smtpUser: formState.smtpUser,
          smtpPassword: formState.smtpPassword.trim() ? formState.smtpPassword : undefined,
          clearSmtpPassword: formState.clearSmtpPassword,

          sftpHost: formState.sftpHost,
          sftpPort: Number.isFinite(sftpPort) ? sftpPort : undefined,
          sftpUser: formState.sftpUser,
          sftpRemoteRoot: formState.sftpRemoteRoot,
          sftpPassword: formState.sftpPassword.trim() ? formState.sftpPassword : undefined,
          clearSftpPassword: formState.clearSftpPassword,
          sftpPrivateKey: formState.sftpPrivateKey.trim() ? formState.sftpPrivateKey : undefined,
          clearSftpPrivateKey: formState.clearSftpPrivateKey,
        }),
      });

      const payload =
        (await readJson<{ message?: string; settings?: IntegrationSettingsRecord | null }>(response)) ?? {};

      if (!response.ok) {
        throw new Error(payload.message ?? "Integrationen konnten nicht gespeichert werden.");
      }

      await refreshSettings();
      const nextSaved = { ...formState, smtpPassword: "", sftpPassword: "", sftpPrivateKey: "" };
      setSavedState(nextSaved);
      setFormState(nextSaved);
      setStatusMessage(payload.message ?? "Integrationen wurden gespeichert.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Integrationen konnten nicht gespeichert werden.");
    } finally {
      setIsSaving(false);
    }
  }

  async function sendTestMail() {
    setMailTestStatus("Sende Testmail...");
    try {
      const response = await fetch("/api/settings/integrations/test-mail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: formState.testMailTo }),
      });
      const payload = (await readJson<{ message?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(payload.message ?? "Testmail fehlgeschlagen.");
      setMailTestStatus(payload.message ?? "Testmail wurde versendet.");
    } catch (error) {
      setMailTestStatus(error instanceof Error ? error.message : "Testmail fehlgeschlagen.");
    }
  }

  async function testSftp() {
    setSftpTestStatus("Teste SFTP Verbindung...");
    try {
      const response = await fetch("/api/settings/integrations/test-sftp", { method: "POST" });
      const payload = (await readJson<{ message?: string }>(response)) ?? {};
      if (!response.ok) throw new Error(payload.message ?? "SFTP Test fehlgeschlagen.");
      setSftpTestStatus(payload.message ?? "SFTP Verbindung erfolgreich.");
    } catch (error) {
      setSftpTestStatus(error instanceof Error ? error.message : "SFTP Test fehlgeschlagen.");
    }
  }

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Einstellungen</p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className={chrome.heroTitle}>Integrationen</h1>
            <p className={chrome.heroText}>Mailserver (ausgehende Mails) und SFTP für Dokumente konfigurieren.</p>
          </div>
          <div className={chrome.heroAccentCard}>
            <p className={chrome.heroAccentEyebrow}>Status</p>
            <p className={chrome.heroAccentValue}>
              {settings?.smtpHost && settings?.smtpUser ? "Mail bereit" : "Mail offen"}
            </p>
            <p className={chrome.heroAccentMeta}>
              {settings?.sftpHost && settings?.sftpUser ? "SFTP bereit" : "SFTP offen"}
            </p>
          </div>
        </div>
        <SettingsTabs lightMode={lightMode} />
      </header>

      <section className={chrome.panel}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className={chrome.sectionTitle}>Konfiguration</h2>
            <p className={chrome.sectionText}>Wird pro Organisation gespeichert und produktiv genutzt.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFormState(savedState)}
              className={chrome.secondaryButton}
              disabled={!hasUnsavedChanges || isSaving}
            >
              Zurücksetzen
            </button>
            <button type="button" onClick={() => void save()} className={chrome.actionButton} disabled={!hasUnsavedChanges || isSaving}>
              {isSaving ? "Speichert..." : "Speichern"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className={`${chrome.subtleInset} text-sm`}>{statusMessage}</div>
          <div className={`${chrome.subtleInset} text-sm`}>
            {hasUnsavedChanges ? "Ungespeicherte Änderungen vorhanden." : "Alle Werte sind gespeichert."}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={chrome.panel}>
          <h2 className={chrome.sectionTitle}>Mailserver (SMTP)</h2>
          <p className={chrome.sectionText}>Für ausgehende Mails (z.B. Angebot/Rechnung versenden).</p>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm">
              <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>SMTP Host</span>
              <input className={chrome.input} value={formState.smtpHost} onChange={(e) => updateField("smtpHost", e.target.value)} placeholder="smtp.example.de" />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Port</span>
                <input className={chrome.input} value={formState.smtpPort} onChange={(e) => updateField("smtpPort", e.target.value)} placeholder="587" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>User</span>
                <input className={chrome.input} value={formState.smtpUser} onChange={(e) => updateField("smtpUser", e.target.value)} placeholder="user@example.de" />
              </label>
            </div>

            <label className="grid gap-2 text-sm">
              <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Passwort (wird nie angezeigt)</span>
              <input className={chrome.input} value={formState.smtpPassword} onChange={(e) => updateField("smtpPassword", e.target.value)} placeholder={settings?.hasSmtpPassword ? "Gesetzt (neu eingeben zum Ändern)" : "Noch nicht gesetzt"} type="password" />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className={`${chrome.subtleInset} flex items-center justify-between gap-3 text-sm`}>
                <span>SMTP Secure (TLS)</span>
                <input type="checkbox" checked={formState.smtpSecure} onChange={(e) => updateField("smtpSecure", e.target.checked)} />
              </label>
              <label className={`${chrome.subtleInset} flex items-center justify-between gap-3 text-sm`}>
                <span>Passwort löschen</span>
                <input type="checkbox" checked={formState.clearSmtpPassword} onChange={(e) => updateField("clearSmtpPassword", e.target.checked)} />
              </label>
            </div>

            <label className="grid gap-2 text-sm">
              <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Absender (From)</span>
              <input className={chrome.input} value={formState.mailFrom} onChange={(e) => updateField("mailFrom", e.target.value)} placeholder="MoveScout <mail@domain.de>" />
            </label>

            <div className="mt-2 grid gap-2">
              <p className={chrome.statLabel}>Testmail</p>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <input className={chrome.input} value={formState.testMailTo} onChange={(e) => updateField("testMailTo", e.target.value)} placeholder="test@domain.de" />
                <button type="button" className={chrome.secondaryButton} onClick={() => void sendTestMail()} disabled={!formState.testMailTo.trim()}>
                  Test senden
                </button>
              </div>
              {mailTestStatus ? <div className={`${chrome.compactSurfaceMuted} text-sm`}>{mailTestStatus}</div> : null}
            </div>
          </div>
        </section>

        <section className={chrome.panel}>
          <h2 className={chrome.sectionTitle}>SFTP</h2>
          <p className={chrome.sectionText}>Für Dokumente (Upload/Synchronisation).</p>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm">
              <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Host</span>
              <input className={chrome.input} value={formState.sftpHost} onChange={(e) => updateField("sftpHost", e.target.value)} placeholder="sftp.example.de" />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Port</span>
                <input className={chrome.input} value={formState.sftpPort} onChange={(e) => updateField("sftpPort", e.target.value)} placeholder="22" />
              </label>
              <label className="grid gap-2 text-sm">
                <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>User</span>
                <input className={chrome.input} value={formState.sftpUser} onChange={(e) => updateField("sftpUser", e.target.value)} placeholder="username" />
              </label>
            </div>

            <label className="grid gap-2 text-sm">
              <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Remote Root</span>
              <input className={chrome.input} value={formState.sftpRemoteRoot} onChange={(e) => updateField("sftpRemoteRoot", e.target.value)} placeholder="/movescout/documents" />
            </label>

            <label className="grid gap-2 text-sm">
              <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Passwort (optional)</span>
              <input className={chrome.input} value={formState.sftpPassword} onChange={(e) => updateField("sftpPassword", e.target.value)} placeholder={settings?.hasSftpPassword ? "Gesetzt (neu eingeben zum Ändern)" : "Noch nicht gesetzt"} type="password" />
            </label>

            <label className="grid gap-2 text-sm">
              <span className={`font-medium ${lightMode ? "text-zinc-700" : "text-zinc-200"}`}>Private Key (optional, PEM)</span>
              <textarea className={`${chrome.input} min-h-[140px]`} value={formState.sftpPrivateKey} onChange={(e) => updateField("sftpPrivateKey", e.target.value)} placeholder={settings?.hasSftpPrivateKey ? "Gesetzt (neu einfügen zum Ändern)" : "-----BEGIN OPENSSH PRIVATE KEY-----"} />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className={`${chrome.subtleInset} flex items-center justify-between gap-3 text-sm`}>
                <span>Passwort löschen</span>
                <input type="checkbox" checked={formState.clearSftpPassword} onChange={(e) => updateField("clearSftpPassword", e.target.checked)} />
              </label>
              <label className={`${chrome.subtleInset} flex items-center justify-between gap-3 text-sm`}>
                <span>Private Key löschen</span>
                <input type="checkbox" checked={formState.clearSftpPrivateKey} onChange={(e) => updateField("clearSftpPrivateKey", e.target.checked)} />
              </label>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={chrome.secondaryButton} onClick={() => void testSftp()}>
                SFTP testen
              </button>
            </div>
            {sftpTestStatus ? <div className={`${chrome.compactSurfaceMuted} text-sm`}>{sftpTestStatus}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
