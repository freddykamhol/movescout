export function getPageChrome(lightMode: boolean) {
  const mutedText = lightMode ? "text-zinc-600" : "text-zinc-300";
  const overline = lightMode ? "text-zinc-500" : "text-zinc-400";
  const bodyText = lightMode ? "text-zinc-900" : "text-white";

  return {
    page: "mx-auto flex w-full max-w-6xl flex-col gap-3 px-3 sm:gap-4 sm:px-4",
    hero: `rounded-2xl p-5 sm:p-6 ${
      lightMode
        ? "bg-gradient-to-r from-zinc-50 via-white to-zinc-50 ring-1 ring-zinc-200"
        : "bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 ring-1 ring-white/10"
    }`,
    heroEyebrow: "text-xs uppercase tracking-[0.2em] text-[#FF007F]",
    heroTitle: `text-2xl font-semibold sm:text-3xl ${bodyText}`,
    heroText: `mt-1 max-w-2xl ${mutedText}`,
    heroAccentCard: "rounded-2xl bg-[#FF007F]/10 px-4 py-3 ring-1 ring-[#FF007F]/30",
    heroAccentEyebrow: `text-xs uppercase tracking-[0.16em] ${mutedText}`,
    heroAccentValue: "mt-2 text-lg font-semibold text-[#FF007F]",
    heroAccentMeta: `text-sm ${lightMode ? "text-zinc-700" : "text-zinc-200"}`,
    statsGrid: "grid gap-3 sm:grid-cols-2 xl:grid-cols-4",
    statCard: `rounded-2xl p-4 ${lightMode ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-950 ring-1 ring-white/10"}`,
    statAccentCard: `rounded-2xl p-4 ${
      lightMode ? "bg-[#FF007F]/10 ring-1 ring-[#FF007F]/25" : "bg-[#FF007F]/15 ring-1 ring-[#FF007F]/35"
    }`,
    statLabel: `text-xs uppercase tracking-[0.18em] ${overline}`,
    statValue: `mt-2 text-3xl font-semibold ${bodyText}`,
    statAccentValue: "mt-2 text-3xl font-semibold text-[#FF007F]",
    statHint: `mt-1 text-sm ${mutedText}`,
    panel: `rounded-2xl p-3 sm:p-4 ${lightMode ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-950 ring-1 ring-white/10"}`,
    panelRoomy: `rounded-2xl p-5 sm:p-6 ${lightMode ? "bg-white ring-1 ring-zinc-200" : "bg-zinc-950 ring-1 ring-white/10"}`,
    subtlePanel: `rounded-2xl p-3 sm:p-4 ${lightMode ? "bg-zinc-50 ring-1 ring-zinc-200" : "bg-zinc-900 ring-1 ring-white/10"}`,
    subtleInset: `rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 ${
      lightMode ? "bg-zinc-50 ring-1 ring-zinc-200" : "bg-zinc-900 ring-1 ring-white/10"
    }`,
    compactSurface: `rounded-lg px-3 py-2 ${lightMode ? "bg-zinc-100 text-zinc-900 ring-1 ring-zinc-200" : "bg-zinc-800 text-zinc-100 ring-1 ring-white/5"}`,
    compactSurfaceMuted: `rounded-lg px-3 py-2 ${
      lightMode ? "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200" : "bg-zinc-900 text-zinc-300 ring-1 ring-white/10"
    }`,
    sectionTitle: "text-lg font-semibold text-[#FF007F]",
    sectionText: `mt-1 text-sm ${mutedText}`,
    mutedText,
    overline,
    bodyText,
    input: `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition ${
      lightMode
        ? "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-[#FF007F] focus:ring-2 focus:ring-[#FF007F]/20"
        : "border-white/10 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 focus:border-[#FF007F] focus:ring-2 focus:ring-[#FF007F]/25"
    }`,
    compactInput: `rounded-lg border px-2.5 py-2 text-xs outline-none transition ${
      lightMode
        ? "border-zinc-300 bg-white text-zinc-900 focus:border-[#FF007F]"
        : "border-white/10 bg-zinc-900 text-zinc-100 focus:border-[#FF007F]"
    }`,
    actionButton: `rounded-xl px-4 py-3 text-sm font-medium transition ${
      lightMode
        ? "bg-zinc-900 text-white hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400"
        : "bg-[#FF007F] text-white shadow-lg shadow-[#FF007F]/35 hover:bg-[#e30072] disabled:bg-zinc-700 disabled:text-zinc-400 disabled:shadow-none"
    }`,
    secondaryButton: `rounded-xl px-4 py-3 text-sm font-medium transition ${
      lightMode
        ? "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
        : "bg-white/10 text-zinc-100 ring-1 ring-white/10 hover:bg-white/15 disabled:bg-zinc-900 disabled:text-zinc-500"
    }`,
    iconButton: `rounded-lg p-1.5 transition ${
      lightMode ? "text-zinc-600 hover:bg-zinc-100" : "text-zinc-300 hover:bg-zinc-800"
    }`,
    primaryLink:
      "rounded-xl bg-[#FF007F] px-4 py-3 text-center text-sm font-medium text-white shadow-lg shadow-[#FF007F]/35 transition hover:bg-[#e30072]",
    tableHeadCell: `px-3 pb-2 text-left text-xs font-semibold uppercase tracking-[0.16em] ${overline}`,
    chip: "rounded-full bg-[#FF007F]/15 px-2.5 py-1 text-xs text-[#FF007F]",
    neutralChip: `rounded-full px-2.5 py-1 ${
      lightMode ? "bg-white text-zinc-700 ring-1 ring-zinc-200" : "bg-zinc-950 text-zinc-200 ring-1 ring-white/10"
    }`,
    emptyState: `rounded-2xl px-4 py-8 text-center text-sm ${lightMode ? "bg-zinc-50 ring-1 ring-zinc-200" : "bg-zinc-900 ring-1 ring-white/10"}`,
  };
}
