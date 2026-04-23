"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";

export default function InvitePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function submit() {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (!token) {
        throw new Error("Einladungslink ist ungültig.");
      }
      if (!password || password.length < 8) {
        throw new Error("Bitte ein Passwort mit mindestens 8 Zeichen setzen.");
      }
      if (password !== passwordRepeat) {
        throw new Error("Passwörter stimmen nicht überein.");
      }

      const response = await fetch("/api/auth/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username, password }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Einladung konnte nicht angenommen werden.");
      }

      setSuccessMessage(payload.message ?? "Einladung angenommen.");
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 600);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Einladung konnte nicht angenommen werden.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Benutzer</p>
        <h1 className={chrome.heroTitle}>Einladung annehmen</h1>
        <p className={chrome.heroText}>Setze ein Passwort, um deinen Zugang zu aktivieren.</p>
      </header>

      <section className={`${chrome.panel} max-w-xl`}>
        <div className="grid gap-3">
          <label className="grid gap-1">
            <span className={`text-xs ${chrome.overline}`}>Benutzername (optional)</span>
            <input className={chrome.input} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label className="grid gap-1">
            <span className={`text-xs ${chrome.overline}`}>Neues Passwort</span>
            <input className={chrome.input} value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" />
          </label>
          <label className="grid gap-1">
            <span className={`text-xs ${chrome.overline}`}>Passwort wiederholen</span>
            <input className={chrome.input} value={passwordRepeat} onChange={(event) => setPasswordRepeat(event.target.value)} type="password" autoComplete="new-password" />
          </label>
        </div>

        {errorMessage ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${lightMode ? "border-red-200 bg-red-50 text-red-700" : "border-red-900/40 bg-red-950/40 text-red-100"}`}>
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${lightMode ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-emerald-900/40 bg-emerald-950/40 text-emerald-100"}`}>
            {successMessage}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={chrome.secondaryButton} onClick={() => router.push("/login")} disabled={isSubmitting}>
            Abbrechen
          </button>
          <button type="button" className={chrome.actionButton} onClick={() => void submit()} disabled={isSubmitting || !password || !passwordRepeat}>
            {isSubmitting ? "Speichert..." : "Zugang aktivieren"}
          </button>
        </div>
      </section>
    </div>
  );
}

