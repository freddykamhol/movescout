type ResolvedPrismaDatabaseUrls = {
  databaseUrl: string;
  shadowDatabaseUrl?: string;
};

export function normalizeDatabaseUrl(databaseUrl: string) {
  return databaseUrl.trim().replace(/^"|"$/g, "");
}

export function resolvePrismaDatabaseUrls(databaseUrl: string | null | undefined): ResolvedPrismaDatabaseUrls | null {
  if (!databaseUrl) {
    return null;
  }

  const normalizedDatabaseUrl = normalizeDatabaseUrl(databaseUrl);

  if (!normalizedDatabaseUrl.startsWith("prisma+postgres://")) {
    return {
      databaseUrl: normalizedDatabaseUrl,
    };
  }

  try {
    const url = new URL(normalizedDatabaseUrl);
    const apiKey = url.searchParams.get("api_key");

    if (!apiKey) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(apiKey, "base64url").toString("utf8")) as {
      databaseUrl?: string;
      shadowDatabaseUrl?: string;
    };

    if (typeof payload.databaseUrl !== "string" || payload.databaseUrl.length === 0) {
      return null;
    }

    return {
      databaseUrl: payload.databaseUrl,
      shadowDatabaseUrl:
        typeof payload.shadowDatabaseUrl === "string" && payload.shadowDatabaseUrl.length > 0
          ? payload.shadowDatabaseUrl
          : undefined,
    };
  } catch {
    return null;
  }
}
