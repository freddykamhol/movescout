"use client";

import { useEffect } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";

export default function EinstellungenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);

  useEffect(() => {
    console.error("Einstellungen error boundary:", error);
  }, [error]);

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Einstellungen</p>
        <h1 className={chrome.heroTitle}>Fehler beim Laden</h1>
        <p className={chrome.heroText}>
          Die Einstellungsseite konnte nicht geladen werden. Häufige Ursache: Datenbank nicht erreichbar oder `DATABASE_URL` ist falsch.
        </p>
      </header>

      <section className={chrome.panel}>
        <div className={`${chrome.subtleInset} grid gap-3 text-sm`}>
          <p className="font-semibold">Details</p>
          <p className={chrome.mutedText}>{error?.message || "Unbekannter Fehler"}</p>
          {error?.digest ? <p className={chrome.mutedText}>Digest: {error.digest}</p> : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={reset} className={chrome.actionButton}>
            Neu laden
          </button>
          <a href="/dashboard" className={chrome.secondaryButton}>
            Zurück zum Dashboard
          </a>
        </div>
      </section>
    </div>
  );
}
