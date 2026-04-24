"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";

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

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);
  const [username, setUsername] = useState("Admin");
  const [password, setPassword] = useState("Admin123");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  async function submit() {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await readJsonResponse<{ message?: string }>(response)) ?? {};
      if (!response.ok) {
        throw new Error(
          payload.message ??
            (response.status
              ? `Login fehlgeschlagen (HTTP ${response.status}). Bitte Plesk App-Root/Proxy und DATABASE_URL prüfen.`
              : "Login fehlgeschlagen."),
        );
      }
      const nextPath = searchParams.get("next")?.trim();
      router.push(nextPath && nextPath.startsWith("/") ? nextPath : "/dashboard");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login fehlgeschlagen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Zugang</p>
        <h1 className={chrome.heroTitle}>Login</h1>
        <p className={chrome.heroText}>Standard-Login: Benutzername Admin / Passwort Admin123 (gültig 1 Tag).</p>
      </header>

      <section className={`${chrome.panel} max-w-xl`}>
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className={`text-xs ${chrome.overline}`}>Benutzername</span>
            <input className={chrome.input} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label className="grid gap-1">
            <span className={`text-xs ${chrome.overline}`}>Passwort</span>
            <input
              className={chrome.input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
        </div>

        {errorMessage ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${lightMode ? "border-red-200 bg-red-50 text-red-700" : "border-red-900/40 bg-red-950/40 text-red-100"}`}>
            {errorMessage}
          </div>
        ) : null}

        {resetStatus ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${lightMode ? "border-zinc-200 bg-zinc-50 text-zinc-700" : "border-white/10 bg-zinc-950 text-zinc-100"}`}>
            {resetStatus}
          </div>
        ) : null}

        {showReset ? (
          <div className={`mt-5 rounded-2xl p-4 ${lightMode ? "bg-zinc-50 ring-1 ring-zinc-200" : "bg-zinc-950 ring-1 ring-white/10"}`}>
            <p className={`text-xs uppercase tracking-[0.16em] ${chrome.overline}`}>Passwort vergessen</p>
            <p className={`mt-2 text-sm ${chrome.mutedText}`}>E-Mail oder Benutzername eingeben. Du bekommst einen Reset-Link per Mail.</p>
            <div className="mt-3 grid gap-2">
              <input className={chrome.input} value={resetIdentifier} onChange={(event) => setResetIdentifier(event.target.value)} placeholder="user@firma.de oder benutzername" />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={chrome.secondaryButton}
                  onClick={() => {
                    setShowReset(false);
                    setResetIdentifier("");
                  }}
                  disabled={isSubmitting}
                >
                  Schließen
                </button>
                <button
                  type="button"
                  className={chrome.actionButton}
                  onClick={async () => {
                    setIsSubmitting(true);
                    setResetStatus(null);
                    try {
                      const response = await fetch("/api/auth/password-reset/request", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ identifier: resetIdentifier }),
                      });
                      const payload = (await readJsonResponse<{ message?: string }>(response)) ?? {};
                      if (!response.ok) {
                        throw new Error(payload.message ?? "Reset konnte nicht ausgelöst werden.");
                      }
                      setResetStatus(payload.message ?? "Wenn der Benutzer existiert, wurde eine Mail versendet.");
                      setShowReset(false);
                    } catch (error) {
                      setResetStatus(error instanceof Error ? error.message : "Reset konnte nicht ausgelöst werden.");
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting || !resetIdentifier.trim()}
                >
                  {isSubmitting ? "Sendet..." : "Reset-Link senden"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className={chrome.secondaryButton}
            onClick={() => {
              setShowReset((value) => !value);
              setResetStatus(null);
              setErrorMessage(null);
            }}
            disabled={isSubmitting}
          >
            Passwort vergessen
          </button>
          <button type="button" className={chrome.secondaryButton} onClick={() => router.push("/dashboard")} disabled={isSubmitting}>
            Überspringen
          </button>
          <button type="button" className={chrome.actionButton} onClick={() => void submit()} disabled={isSubmitting || !username || !password}>
            {isSubmitting ? "Anmelden..." : "Anmelden"}
          </button>
        </div>
      </section>
    </div>
  );
}
