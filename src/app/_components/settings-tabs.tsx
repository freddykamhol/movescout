"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SettingsTab = {
  href: string;
  label: string;
  matches: (pathname: string) => boolean;
};

const settingsTabs: SettingsTab[] = [
  { href: "/einstellungen/preise", label: "Preise", matches: (pathname) => pathname === "/einstellungen/preise" || pathname.startsWith("/einstellungen/preise/") },
  { href: "/einstellungen/firma", label: "Firma", matches: (pathname) => pathname === "/einstellungen/firma" || pathname.startsWith("/einstellungen/firma/") },
  { href: "/einstellungen/benutzer", label: "Benutzer", matches: (pathname) => pathname === "/einstellungen/benutzer" || pathname.startsWith("/einstellungen/benutzer/") },
  { href: "/einstellungen/organigramm", label: "Organigramm", matches: (pathname) => pathname === "/einstellungen/organigramm" || pathname.startsWith("/einstellungen/organigramm/") },
  { href: "/einstellungen/integrationen", label: "Integrationen", matches: (pathname) => pathname === "/einstellungen/integrationen" || pathname.startsWith("/einstellungen/integrationen/") },
  { href: "/einstellungen/profil", label: "Profil", matches: (pathname) => pathname === "/einstellungen/profil" || pathname.startsWith("/einstellungen/profil/") },
];

export default function SettingsTabs({ lightMode }: { lightMode: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Einstellungen" className="mt-5 flex flex-wrap gap-2">
      {settingsTabs.map((tab) => {
        const active = tab.matches(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[#FF007F] text-white shadow-lg shadow-[#FF007F]/25"
                : lightMode
                  ? "bg-white/70 text-zinc-800 ring-1 ring-zinc-200 hover:bg-white"
                  : "bg-white/5 text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
            }`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

