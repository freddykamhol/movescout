"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { getPageChrome } from "@/app/_components/page-styles";

type LoginResponse =
  | { ok: true }
  | {
      message?: string;
    };

export default function LoginPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { lightMode } = useDashboardAppearance();
  const chrome = getPageChrome(lightMode);
  const nextPath = params.get("next") || "/dashboard";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const containerClass = useMemo(
    () =>
      `min-h-screen w-full p-3 md:p-4 ${
        lightMode ? "bg-zinc-100 text-zinc-900" : "bg-zinc-950 text-zinc-100"
      }`,
    [lightMode],
  );

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as LoginResponse;

      if (!response.ok) {
        setError(payload && "message" in payload && payload.message ? payload.message : "Login fehlgeschlagen.");
        return;
      }

      router.replace(nextPath);
    } catch {
      setError("Login fehlgeschlagen.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={containerClass}>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center py-10">
        <div className={`${chrome.panel} w-full max-w-md`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#FF007F]">MoveScout</p>
              <h1 className="mt-2 text-2xl font-semibold">Login</h1>
              <p className={`mt-1 text-sm ${chrome.mutedText}`}>Bitte mit Benutzername und Passwort anmelden.</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-5 grid gap-3">
            <label className="grid gap-1">
              <span className={`text-xs uppercase tracking-[0.18em] ${chrome.overline}`}>Benutzername</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={chrome.input}
                autoComplete="username"
              />
            </label>
            <label className="grid gap-1">
              <span className={`text-xs uppercase tracking-[0.18em] ${chrome.overline}`}>Passwort</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={chrome.input}
                autoComplete="current-password"
              />
            </label>

            {error ? (
              <div
                className={`rounded-2xl px-4 py-3 text-sm ring-1 ${
                  lightMode ? "bg-red-500/10 text-red-700 ring-red-500/20" : "bg-red-500/12 text-red-200 ring-red-500/25"
                }`}
              >
                {error}
              </div>
            ) : null}

            <button type="submit" className={chrome.actionButton} disabled={isSubmitting}>
              {isSubmitting ? "Anmelden..." : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

