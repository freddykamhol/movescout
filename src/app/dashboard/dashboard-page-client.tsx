"use client";

import Link from "next/link";
import { memo, useEffect, useMemo, useState } from "react";

import { useDashboardAppearance } from "@/app/_components/app-shell";
import { useMoveWizard } from "@/app/_components/move-wizard";
import { getPageChrome } from "@/app/_components/page-styles";
import type { DashboardData, DashboardPlannedMoveRecord } from "@/lib/dashboard-data";

const calendarWeekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const longDateFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const monthFormatter = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
});

type CalendarCell = { day: number; hasPlan: boolean; isoDay: string } | null;

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function fromIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12, 0, 0);
}

function buildCalendarMonth(calendarMonth: Date, plannedMoves: DashboardPlannedMoveRecord[]) {
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const monthEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const monthLabel = monthFormatter.format(monthStart);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const daysInMonth = monthEnd.getDate();
  const monthStartIso = toIsoDate(monthStart);
  const monthEndIso = toIsoDate(monthEnd);
  const calendarCells: CalendarCell[] = Array.from({ length: startOffset }, () => null);
  const movesByDay = new Map<string, DashboardPlannedMoveRecord[]>();

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isoDay = toIsoDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), day));
    const movesOnDay = plannedMoves.filter((move) => move.plannedDayIso === isoDay);

    calendarCells.push({
      day,
      hasPlan: movesOnDay.length > 0,
      isoDay,
    });

    if (movesOnDay.length > 0) {
      movesByDay.set(isoDay, movesOnDay);
    }
  }

  return {
    calendarCells,
    monthEndIso,
    monthLabel,
    monthStartIso,
    movesByDay,
    movesInMonth: plannedMoves.filter((move) => move.plannedDayIso >= monthStartIso && move.plannedDayIso <= monthEndIso),
  };
}

const LiveClockCard = memo(function LiveClockCard({ lightMode }: { lightMode: boolean }) {
  const [now, setNow] = useState(() => new Date());
  const chrome = getPageChrome(lightMode);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className={chrome.heroAccentCard}>
      <p className={chrome.heroAccentEyebrow}>Aktuelle Zeit / Datum</p>
      <p className="text-2xl font-semibold text-[#FF007F]">{timeFormatter.format(now)}</p>
      <p className={chrome.heroAccentMeta}>{longDateFormatter.format(now)}</p>
    </div>
  );
});

const MoveCalendarCard = memo(function MoveCalendarCard({
  lightMode,
  plannedMoves,
}: {
  lightMode: boolean;
  plannedMoves: DashboardPlannedMoveRecord[];
}) {
  const chrome = getPageChrome(lightMode);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedIsoDay, setSelectedIsoDay] = useState(() => toIsoDate(new Date()));
  const monthData = useMemo(() => buildCalendarMonth(calendarMonth, plannedMoves), [calendarMonth, plannedMoves]);
  const todayIso = toIsoDate(new Date());
  const selectionIsInMonth = selectedIsoDay >= monthData.monthStartIso && selectedIsoDay <= monthData.monthEndIso;
  const activeDayMoves = monthData.movesByDay.get(selectedIsoDay) ?? [];
  const selectedDayLabel = selectionIsInMonth ? longDateFormatter.format(fromIsoDate(selectedIsoDay)) : null;

  function shiftCalendarMonth(delta: number) {
    setCalendarMonth((previousValue) => new Date(previousValue.getFullYear(), previousValue.getMonth() + delta, 1));
  }

  function jumpToToday() {
    const today = new Date();

    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedIsoDay(toIsoDate(today));
  }

  return (
    <article className={chrome.panelRoomy}>
      <div className="flex items-center justify-between">
        <h2 className={chrome.sectionTitle}>Geplante Umzugstermine</h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shiftCalendarMonth(-1)} className={chrome.iconButton} aria-label="Vormonat">
            <span className="block h-4 w-4 rotate-0 border-l-2 border-t-2 border-current" />
          </button>
          <button type="button" onClick={jumpToToday} className={chrome.secondaryButton}>
            Heute
          </button>
          <button type="button" onClick={() => shiftCalendarMonth(1)} className={chrome.iconButton} aria-label="Nächster Monat">
            <span className="block h-4 w-4 rotate-180 border-l-2 border-t-2 border-current" />
          </button>
        </div>
      </div>
      <p className={`mt-1 text-xs uppercase tracking-[0.18em] ${chrome.overline}`}>{monthData.monthLabel}</p>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">
        {calendarWeekdays.map((day) => (
          <div key={day} className={chrome.overline}>
            {day}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {monthData.calendarCells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} className="h-8 rounded-md" />;
          }

          const isSelected = selectedIsoDay === cell.isoDay;
          const isToday = todayIso === cell.isoDay;

          return (
            <button
              type="button"
              key={cell.isoDay}
              onClick={() => setSelectedIsoDay(cell.isoDay)}
              className={`relative flex h-9 items-center justify-center rounded-md text-xs transition ${
                isSelected
                  ? "bg-[#FF007F] font-semibold text-white shadow-lg shadow-[#FF007F]/35"
                  : cell.hasPlan
                    ? lightMode
                      ? "bg-[#FF007F]/15 text-[#c00062] ring-1 ring-[#FF007F]/30 hover:bg-[#FF007F]/25"
                      : "bg-[#FF007F]/20 text-[#ff6ab1] ring-1 ring-[#FF007F]/40 hover:bg-[#FF007F]/30"
                    : lightMode
                      ? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-200"
                      : "bg-zinc-800 text-zinc-300 ring-1 ring-white/5 hover:bg-zinc-700"
              }`}
              title={`${cell.day}. ${monthData.monthLabel}`}
            >
              {isToday ? (
                <span className={`absolute left-1 top-1 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#FF007F]"}`} />
              ) : null}
              {cell.day}
              {cell.hasPlan && !isSelected ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#FF007F]" /> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-2">
        <div className={`${chrome.compactSurfaceMuted} text-xs`}>
          {selectedDayLabel ? `Ausgewählter Tag: ${selectedDayLabel}` : "Wähle einen Tag in diesem Monat aus."}
        </div>

        {selectionIsInMonth && activeDayMoves.length === 0 ? (
          <div className={`${chrome.compactSurfaceMuted} text-sm`}>Kein geplanter Umzug an diesem Tag.</div>
        ) : null}

        {activeDayMoves.map((move) => (
          <div key={move.id} className={`${chrome.compactSurface} text-sm`}>
            <p className="font-medium">
              {move.moveNumber} | {move.customerName}
            </p>
            <p className={chrome.mutedText}>
              {move.routeLabel} | {move.plannedDateLabel} | {move.statusLabel}
            </p>
          </div>
        ))}

        <div className={`${chrome.compactSurfaceMuted} text-xs`}>
          {monthData.movesInMonth.length} geplante Termine in {monthData.monthLabel}
        </div>
      </div>
    </article>
  );
});

function DashboardOverviewContent({ initialData }: { initialData: DashboardData }) {
  const { lightMode } = useDashboardAppearance();
  const { openMoveWizard } = useMoveWizard();
  const chrome = getPageChrome(lightMode);

  return (
    <div className={chrome.page}>
      <header className={chrome.hero}>
        <p className={chrome.heroEyebrow}>Live-Übersicht</p>
        <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className={chrome.heroTitle}>Dashboard Zentrale</h1>
            <p className={chrome.heroText}>Alle wichtigen Zahlen, Kunden, Umzüge und letzten Änderungen auf einen Blick.</p>
          </div>
          <LiveClockCard lightMode={lightMode} />
        </div>
      </header>

      <div className={chrome.statsGrid}>
        <article className={chrome.statAccentCard}>
          <p className={chrome.statLabel}>Umzüge Gesamt</p>
          <p className={chrome.statAccentValue}>{initialData.totalMoves}</p>
          <p className={chrome.statHint}>in der Datenbank</p>
        </article>
        {initialData.stats.map((item) => (
          <article key={item.label} className={chrome.statCard}>
            <p className={chrome.statLabel}>{item.label}</p>
            <p className={chrome.statValue}>{item.value}</p>
            <p className={chrome.statHint}>{item.hint}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1.2fr_1fr]">
        <div className="grid gap-4 xl:grid-cols-2">
          <article className={chrome.panelRoomy}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={chrome.sectionTitle}>10 letzte Neukunden</h2>
              <span className={chrome.chip}>Echt</span>
            </div>
            {initialData.latestCustomers.length === 0 ? (
              <div className={chrome.emptyState}>Noch keine Kunden vorhanden.</div>
            ) : (
              <ul className="space-y-2">
                {initialData.latestCustomers.map((customer, index) => (
                  <li key={customer.id} className={chrome.compactSurface}>
                    <p className={chrome.bodyText}>
                      {index + 1}. {customer.label}
                    </p>
                    <p className={`mt-1 text-xs ${chrome.overline}`}>{customer.subtitle}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className={chrome.panelRoomy}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={chrome.sectionTitle}>10 letzte Umzüge</h2>
              <span className={chrome.chip}>Echt</span>
            </div>
            {initialData.latestMoves.length === 0 ? (
              <div className={chrome.emptyState}>Noch keine Umzüge vorhanden.</div>
            ) : (
              <ul className="space-y-2">
                {initialData.latestMoves.map((move, index) => (
                  <li key={move.id} className={chrome.compactSurface}>
                    <p className={chrome.bodyText}>
                      {index + 1}. {move.label}
                    </p>
                    <p className={`mt-1 text-xs ${chrome.overline}`}>{move.subtitle}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <div className="grid gap-4">
          <article className={chrome.panelRoomy}>
            <h2 className={chrome.sectionTitle}>Letzte Aktivitäten</h2>
            {initialData.latestActivities.length === 0 ? (
              <div className={`mt-4 ${chrome.emptyState}`}>Noch keine letzten Änderungen vorhanden.</div>
            ) : (
              <ul className="mt-4 space-y-3">
                {initialData.latestActivities.map((entry) => (
                  <li key={entry.id} className={chrome.compactSurface}>
                    <p className={`text-sm ${chrome.bodyText}`}>{entry.text}</p>
                    <p className={`mt-1 text-xs ${chrome.overline}`}>{entry.time}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <MoveCalendarCard lightMode={lightMode} plannedMoves={initialData.plannedMoves} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/kunden" className={chrome.primaryLink}>
          Kundenverwaltung
        </Link>
        <Link href="/umzuege" className={chrome.primaryLink}>
          Umzüge öffnen
        </Link>
        <button type="button" onClick={() => openMoveWizard({ sourceLabel: "Dashboard" })} className={chrome.actionButton}>
          Umzug anlegen
        </button>
      </div>
    </div>
  );
}

export default function DashboardPageClient({ initialData }: { initialData: DashboardData }) {
  return <DashboardOverviewContent initialData={initialData} />;
}
