import { Pool } from "pg";

function shouldUseSsl(connectionString: string): { ssl: false | { rejectUnauthorized: boolean } } {
  try {
    const url = new URL(connectionString);
    const sslmode = (url.searchParams.get("sslmode") || "").toLowerCase();
    const sslParam = (url.searchParams.get("ssl") || "").toLowerCase();

    if (sslmode === "disable") return { ssl: false };
    if (sslmode === "verify-ca" || sslmode === "verify-full") return { ssl: { rejectUnauthorized: true } };
    if (sslmode === "require" || sslmode === "prefer") return { ssl: { rejectUnauthorized: false } };

    if (sslParam === "true" || sslParam === "1") return { ssl: { rejectUnauthorized: false } };
  } catch {
    // Ignore parse failures and fall back to non-SSL.
  }

  return { ssl: false };
}

export function createPgPool(connectionString: string) {
  const { ssl } = shouldUseSsl(connectionString);
  return new Pool({
    connectionString,
    ...(ssl ? { ssl } : {}),
  });
}

