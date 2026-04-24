"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { MoveWizardProvider } from "@/app/_components/move-wizard";

type DashboardPage = "dashboard" | "customers" | "documents" | "moves" | "settings" | null;
type DashboardAppearanceContextValue = { lightMode: boolean };
type IconProps = { className?: string };

const DashboardAppearanceContext = createContext<DashboardAppearanceContextValue | null>(null);

function DashboardIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 13h8V3H3zM13 21h8V11h-8zM13 3h8v6h-8zM3 17h8v4H3z" />
    </svg>
  );
}

function CustomersIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6M17 11h6" />
    </svg>
  );
}

function MovesIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 7h12v9H3z" />
      <path d="M15 10h3l3 3v3h-6z" />
      <circle cx="7.5" cy="18.5" r="1.5" />
      <circle cx="17.5" cy="18.5" r="1.5" />
    </svg>
  );
}

function DocumentsIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5M9 13h8M9 17h8" />
    </svg>
  );
}

function SettingsIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-.33-1 1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1-.33H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1-.33 1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .33 1 1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.32.2.66.19 1a1.65 1.65 0 0 0 .6 1 1.65 1.65 0 0 0 1 .33H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1 .33 1.65 1.65 0 0 0-.51.34Z" />
    </svg>
  );
}

function ChevronIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function UserIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

function SunIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </svg>
  );
}

function MoonIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  );
}

function SideChevronIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

type SidebarLinkProps = {
  active?: boolean;
  collapsed: boolean;
  href?: string;
  icon: ReactNode;
  label: string;
  lightMode: boolean;
};

function SidebarLink({ active, collapsed, href, icon, label, lightMode }: SidebarLinkProps) {
  const className = `group relative flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
    active
      ? lightMode
        ? "bg-[#FF007F] text-white ring-1 ring-[#FF007F]/40"
        : "bg-[#FF007F] text-white shadow-lg shadow-[#FF007F]/35"
      : lightMode
        ? "text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950"
        : "text-zinc-300 hover:bg-white/10 hover:text-white"
  } ${collapsed ? "justify-center px-2" : "gap-3"}`;

  const iconClassName = active
    ? "text-white"
    : lightMode
      ? "text-zinc-500 group-hover:text-zinc-900"
      : "text-zinc-400 group-hover:text-white";

  const content = (
    <>
      <span className={iconClassName}>{icon}</span>
      {collapsed ? null : <span>{label}</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} title={collapsed ? label : undefined}>
      {content}
    </button>
  );
}

export function useDashboardAppearance() {
  const context = useContext(DashboardAppearanceContext);

  if (!context) {
    throw new Error("useDashboardAppearance must be used within AppShell.");
  }

  return context;
}

function getActivePage(pathname: string): DashboardPage {
  if (pathname === "/kunden" || pathname.startsWith("/kunden/")) {
    return "customers";
  }

  if (pathname === "/dokumente" || pathname.startsWith("/dokumente/")) {
    return "documents";
  }

  if (pathname === "/umzuege" || pathname.startsWith("/umzuege/")) {
    return "moves";
  }

  if (pathname === "/einstellungen" || pathname.startsWith("/einstellungen/")) {
    return "settings";
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "dashboard";
  }

  return null;
}

function hasAppSidebar(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/kunden" ||
    pathname.startsWith("/kunden/") ||
    pathname === "/dokumente" ||
    pathname.startsWith("/dokumente/") ||
    pathname === "/umzuege" ||
    pathname.startsWith("/umzuege/") ||
    pathname === "/einstellungen" ||
    pathname.startsWith("/einstellungen/")
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ displayName: string; role: string } | null>(null);
  const [sessionOrg, setSessionOrg] = useState<{ name: string; orgKey: string } | null>(null);
  const activePage = getActivePage(pathname);
  const showSidebar = hasAppSidebar(pathname);
  const appearanceValue = useMemo(() => ({ lightMode }), [lightMode]);
  const settingsButtonClass = `mt-1 flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
    activePage === "settings"
      ? lightMode
        ? "bg-[#FF007F] text-white ring-1 ring-[#FF007F]/40"
        : "bg-[#FF007F] text-white shadow-lg shadow-[#FF007F]/35"
      : lightMode
        ? "text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950"
        : "text-zinc-300 hover:bg-white/10 hover:text-white"
  } ${sidebarCollapsed ? "justify-center px-2" : "gap-3"}`;
  const settingsIconClass = activePage === "settings"
    ? "text-white"
    : lightMode
      ? "text-zinc-500"
      : "text-zinc-400";

  useEffect(() => {
    let aborted = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (response.status === 401) {
          if (!aborted && pathname !== "/login") {
            router.push(`/login?next=${encodeURIComponent(pathname)}`);
            router.refresh();
          }
          return;
        }
        const payload = (await response.json()) as {
          organization?: { name: string; orgKey: string };
          user?: { displayName: string; role: string };
        };

        if (!response.ok || !payload.user) {
          return;
        }

        if (aborted) {
          return;
        }

        setSessionUser(payload.user);
        if (payload.organization) {
          setSessionOrg(payload.organization);
        }
      } catch {
        // ignore
      }
    }

    void loadSession();

    return () => {
      aborted = true;
    };
  }, [pathname, router]);

  const displayName = sessionUser?.displayName?.trim() ?? "";
  const userInitials = (() => {
    if (!displayName) {
      return "MS";
    }

    const parts = displayName.split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
    return letters.join("") || "MS";
  })();

  const userRoleLabel = (() => {
    if (!sessionUser?.role) {
      return "Benutzer";
    }

    if (sessionUser.role === "OWNER") {
      return "Owner";
    }

    if (sessionUser.role === "ADMIN") {
      return "Administrator";
    }

    if (sessionUser.role === "VIEWER") {
      return "Lesen";
    }

    return "Mitarbeiter";
  })();

  return (
    <DashboardAppearanceContext.Provider value={appearanceValue}>
      <MoveWizardProvider lightMode={lightMode}>
        <div className="sticky top-0 z-50 w-full">
          <div className="flex w-full items-center justify-center bg-[#FF007F] px-3 py-2 text-center text-xs font-semibold tracking-[0.22em] text-white">
            KEIN PRODUKTIVSYSTEM!
          </div>
        </div>
        {showSidebar ? (
          <main
            className={`min-h-screen w-full p-3 md:p-4 ${
              lightMode ? "bg-zinc-100 text-zinc-900" : "bg-zinc-950 text-zinc-100"
            }`}
          >
            <div className="flex w-full flex-col gap-4 lg:flex-row">
              <aside
                className={`relative flex w-full flex-col rounded-3xl transition-all duration-300 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:shrink-0 lg:self-start ${
                  sidebarCollapsed ? "p-3 lg:w-24" : "p-4 lg:w-72"
                } ${
                  lightMode
                    ? "bg-gradient-to-b from-zinc-200 to-zinc-100 ring-1 ring-zinc-300"
                    : "bg-gradient-to-b from-zinc-900 to-zinc-950 ring-1 ring-white/10"
                }`}
              >
                <div
                  className={`rounded-2xl p-4 ring-1 ring-[#FF007F]/40 ${
                    lightMode ? "bg-[#FF007F]/10" : "bg-[#FF007F]/15"
                  }`}
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-[#FF007F]">
                    {sidebarCollapsed ? "MS" : "MoveScout"}
                  </p>
                  {sidebarCollapsed ? null : (
                    <h1 className={`mt-2 text-xl font-semibold ${lightMode ? "text-zinc-900" : "text-white"}`}>
                      Hauptmenü
                    </h1>
                  )}
                </div>

                <nav className="mt-5 flex-1 space-y-1 overflow-y-auto pr-1">
                  <SidebarLink
                    active={activePage === "dashboard"}
                    collapsed={sidebarCollapsed}
                    href="/dashboard"
                    icon={<DashboardIcon />}
                    label="Dashboard"
                    lightMode={lightMode}
                  />
                  <SidebarLink
                    active={activePage === "customers"}
                    collapsed={sidebarCollapsed}
                    href="/kunden"
                    icon={<CustomersIcon />}
                    label="Kunden"
                    lightMode={lightMode}
                  />
                  <SidebarLink
                    active={activePage === "moves"}
                    collapsed={sidebarCollapsed}
                    href="/umzuege"
                    icon={<MovesIcon />}
                    label="Umzüge"
                    lightMode={lightMode}
                  />
                  <SidebarLink
                    active={activePage === "documents"}
                    collapsed={sidebarCollapsed}
                    href="/dokumente"
                    icon={<DocumentsIcon />}
                    label="Dokumente"
                    lightMode={lightMode}
                  />

                  <button
                    type="button"
                    onClick={() => setSettingsOpen((previousValue) => !previousValue)}
                    className={settingsButtonClass}
                    title={sidebarCollapsed ? "Einstellungen" : undefined}
                  >
                    <span className={settingsIconClass}>
                      <SettingsIcon />
                    </span>
                    {sidebarCollapsed ? null : <span className="flex-1">Einstellungen</span>}
                    {sidebarCollapsed ? null : (
                      <ChevronIcon
                        className={`h-4 w-4 transition ${settingsOpen ? "rotate-180" : "rotate-0"} ${
                          activePage === "settings" ? "text-white" : lightMode ? "text-zinc-500" : "text-zinc-400"
                        }`}
                      />
                    )}
                  </button>

                  {settingsOpen && !sidebarCollapsed ? (
                    <div className={`ml-4 mt-1 space-y-1 border-l pl-3 ${lightMode ? "border-zinc-300" : "border-white/10"}`}>
                      <SidebarLink
                        active={pathname === "/einstellungen" || pathname === "/einstellungen/preise" || pathname.startsWith("/einstellungen/preise/")}
                        collapsed={false}
                        href="/einstellungen/preise"
                        icon={<SettingsIcon className="h-4 w-4" />}
                        label="Preise"
                        lightMode={lightMode}
                      />
                      <SidebarLink
                        active={pathname === "/einstellungen/firma" || pathname.startsWith("/einstellungen/firma/")}
                        collapsed={false}
                        href="/einstellungen/firma"
                        icon={<DashboardIcon className="h-4 w-4" />}
                        label="Firmendaten"
                        lightMode={lightMode}
                      />
                      <SidebarLink
                        active={pathname === "/einstellungen/benutzer" || pathname.startsWith("/einstellungen/benutzer/")}
                        collapsed={false}
                        href="/einstellungen/benutzer"
                        icon={<UserIcon className="h-4 w-4" />}
                        label="Benutzer"
                        lightMode={lightMode}
                      />
	                      <SidebarLink
	                        active={pathname === "/einstellungen/organigramm" || pathname.startsWith("/einstellungen/organigramm/")}
	                        collapsed={false}
	                        href="/einstellungen/organigramm"
	                        icon={<ChevronIcon className="h-4 w-4" />}
	                        label="Organigramm"
	                        lightMode={lightMode}
	                      />
	                      <SidebarLink
	                        active={pathname === "/einstellungen/integrationen" || pathname.startsWith("/einstellungen/integrationen/")}
	                        collapsed={false}
	                        href="/einstellungen/integrationen"
	                        icon={<DocumentsIcon className="h-4 w-4" />}
	                        label="Integrationen"
	                        lightMode={lightMode}
	                      />
	                    </div>
	                  ) : null}
	                </nav>

                <div className="mt-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setLightMode((previousValue) => !previousValue)}
                    className={`mb-2 flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      lightMode
                        ? "bg-zinc-900 text-white hover:bg-zinc-800"
                        : "bg-white/10 text-zinc-100 hover:bg-white/15"
                    } ${sidebarCollapsed ? "justify-center px-2" : "justify-between"}`}
                    title={sidebarCollapsed ? (lightMode ? "Darkmode" : "Lightmode") : undefined}
                  >
                    <span className="flex items-center gap-2">
                    {lightMode ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
                    {sidebarCollapsed ? null : lightMode ? "Darkmode" : "Lightmode"}
                    </span>
                    {sidebarCollapsed ? null : <span className="text-xs text-[#FF007F]">{lightMode ? "AN" : "AUS"}</span>}
                  </button>

                  <div
                    className={`rounded-2xl ${
                      sidebarCollapsed ? "p-1.5" : "p-2"
                    } ${lightMode ? "bg-zinc-200 ring-1 ring-zinc-300" : "bg-white/5 ring-1 ring-white/10"}`}
                  >
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen((previousValue) => !previousValue)}
                      className={`flex w-full items-center rounded-xl px-2 py-2 text-left transition ${
                        lightMode ? "text-zinc-800 hover:bg-zinc-300" : "text-zinc-200 hover:bg-white/10"
                      } ${sidebarCollapsed ? "justify-center px-1.5" : "gap-3"}`}
                      title={sidebarCollapsed ? "Benutzer" : undefined}
                    >
                      <div
                        className={`flex items-center justify-center rounded-full bg-[#FF007F] text-sm font-semibold text-white ${
                          sidebarCollapsed ? "h-9 w-9" : "h-10 w-10"
                        }`}
                      >
                        {userInitials}
                      </div>
                      {sidebarCollapsed ? null : (
                        <>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{sessionUser?.displayName ?? "Benutzer"}</p>
                            <p className={`text-xs ${lightMode ? "text-zinc-500" : "text-zinc-400"}`}>
                              {userRoleLabel}
                              {sessionOrg?.name ? ` · ${sessionOrg.name}` : sessionOrg?.orgKey ? ` · ${sessionOrg.orgKey}` : ""}
                            </p>
                          </div>
                          <ChevronIcon
                            className={`h-4 w-4 transition ${userMenuOpen ? "rotate-180" : "rotate-0"} ${
                              lightMode ? "text-zinc-500" : "text-zinc-400"
                            }`}
                          />
                        </>
                      )}
                    </button>

                    {userMenuOpen && !sidebarCollapsed ? (
                      <div className="mt-2 grid gap-2 px-2 pb-2">
                        <Link
                          href="/einstellungen/profil"
                          className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                            lightMode
                              ? "bg-zinc-300 text-zinc-900 hover:bg-zinc-400"
                              : "bg-white/10 text-zinc-100 hover:bg-white/15"
                          }`}
                        >
                          Eigenen Benutzer bearbeiten
                        </Link>
                        <Link
                          href="/einstellungen/benutzer"
                          className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                            lightMode
                              ? "bg-zinc-300 text-zinc-900 hover:bg-zinc-400"
                              : "bg-white/10 text-zinc-100 hover:bg-white/15"
                          }`}
                        >
                          Benutzer verwalten
                        </Link>
                        <Link
                          href="/einstellungen/firma"
                          className="rounded-lg bg-[#FF007F]/90 px-3 py-2 text-left text-sm font-medium text-white transition hover:bg-[#e30072]"
                        >
                          Firmendaten
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((previousValue) => !previousValue)}
                  className={`absolute -right-3 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border text-xs transition lg:flex ${
                    lightMode
                      ? "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100"
                      : "border-white/15 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                  }`}
                  aria-label={sidebarCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
                  title={sidebarCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
                >
                  <SideChevronIcon className={`h-3.5 w-3.5 ${sidebarCollapsed ? "rotate-180" : "rotate-0"}`} />
                </button>
              </aside>

              <section
                className={`flex-1 rounded-3xl p-5 md:p-6 ${
                  lightMode ? "bg-white ring-1 ring-zinc-300" : "bg-zinc-900 ring-1 ring-white/10"
                }`}
              >
                {children}
              </section>
            </div>
          </main>
        ) : (
          children
        )}
      </MoveWizardProvider>
    </DashboardAppearanceContext.Provider>
  );
}
