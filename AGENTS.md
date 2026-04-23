# MoveScout UI Guide

## Styling
- Verwende fuer App-Seiten die zentralen Tokens aus `src/app/_components/page-styles.ts`.
- Jede Hauptseite (`/dashboard`, `/kunden`, `/umzuege`) beginnt mit `getPageChrome(lightMode)` und nutzt `page`, `hero`, `statsGrid`, `panel`, `subtlePanel`, `actionButton`, `secondaryButton`, `input`.
- Seitenbreite: `max-w-6xl`. Keine frei expandierenden Vollbreiten-Layouts fuer Arbeitsseiten.
- Visuelle Sprache: `#FF007F` als Primarakzent, Zink-Flaechen, abgerundete Karten (`rounded-2xl`), konsistente Abstaende mit `gap-4`.

## Interaktion
- Platzhalter-Workflows sollen keine Fake-Status speichern. Verwende stattdessen klare Aktionen mit Hinweis `Folgt!`.
- Pro Tabelle moeglichst nur eine Aktionsspalte statt mehrfacher Einzelbuttons, wenn die Funktion noch nicht final ist.
- Zusatzformulare unterhalb einer Uebersicht nur bauen, wenn sie wirklich benoetigt oder explizit angefordert sind.

## Umsetzung
- Bestehende Muster in `dashboard`, `kunden` und `umzuege` angleichen statt neue visuelle Varianten einzufuehren.
- Bei neuen Seiten zuerst gemeinsame Tokens erweitern, dann die Seite darauf aufbauen.
