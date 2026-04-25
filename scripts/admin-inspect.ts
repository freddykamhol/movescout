import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { resolvePrismaDatabaseUrls } from "../src/lib/prisma-database-url";

type ArgMap = Record<string, string | boolean>;

function parseArgs(argv: string[]): ArgMap {
  const out: ArgMap = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i] ?? "";
    if (!raw.startsWith("--")) continue;

    const eqIndex = raw.indexOf("=");
    const key = (eqIndex === -1 ? raw.slice(2) : raw.slice(2, eqIndex)).trim();
    if (!key) continue;

    if (eqIndex !== -1) {
      out[key] = raw.slice(eqIndex + 1);
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
      continue;
    }

    out[key] = next;
    i += 1;
  }
  return out;
}

function getStringArg(args: ArgMap, key: string, fallback = "") {
  const value = args[key];
  if (typeof value === "string") return value.trim();
  return fallback;
}

function getBooleanArg(args: ArgMap, key: string) {
  return args[key] === true;
}

function printHelp() {
  console.log(`
Inspect org/user records in the MoveScout database.

Usage:
  npm run admin:inspect -- [--orgKey org_default] [--username admin]

Options:
  --orgKey <key>     Organization key (default: MOVESCOUT_DEFAULT_ORG_KEY or "org_default")
  --username <name>  Optional (case-insensitive lookup)
  --help             Show this help
`.trim());
}

function getDatabaseUrlFromEnv() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRESQL_URL ||
    "";
  const resolved = resolvePrismaDatabaseUrls(raw);
  return resolved?.databaseUrl ?? "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (getBooleanArg(args, "help")) {
    printHelp();
    return;
  }

  const orgKey = (getStringArg(args, "orgKey") || process.env.MOVESCOUT_DEFAULT_ORG_KEY || "org_default").trim();
  const username = getStringArg(args, "username");

  const databaseUrl = getDatabaseUrlFromEnv();
  if (!databaseUrl) {
    console.error("Missing database connection string. Set DATABASE_URL (or PRISMA_DATABASE_URL / POSTGRES_URL).");
    process.exitCode = 2;
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const org = await prisma.organization.findFirst({ where: { orgKey } });
    console.log(`orgKey: ${orgKey}`);
    console.log(`organization: ${org ? "found" : "missing"}`);

    if (username) {
      const user = await prisma.user.findFirst({
        where: { orgKey, username: { equals: username, mode: "insensitive" } },
        select: { id: true, username: true, displayName: true, email: true, role: true, passwordHash: true, createdAt: true },
      });
      if (!user) {
        console.log(`user: missing (username=${username})`);
        process.exitCode = 3;
        return;
      }
      console.log(`user: found`);
      console.log(`id: ${user.id}`);
      console.log(`username: ${user.username ?? "[null]"}`);
      console.log(`displayName: ${user.displayName}`);
      console.log(`email: ${user.email ?? "[null]"}`);
      console.log(`role: ${user.role}`);
      console.log(`passwordHash: ${user.passwordHash ? "[set]" : "[null]"}`);
      console.log(`createdAt: ${user.createdAt.toISOString()}`);
      return;
    }

    const users = await prisma.user.findMany({
      where: { orgKey },
      orderBy: [{ createdAt: "asc" }],
      take: 20,
      select: { id: true, username: true, displayName: true, email: true, role: true, passwordHash: true, createdAt: true },
    });

    console.log(`users (up to 20): ${users.length}`);
    for (const user of users) {
      console.log(
        `- ${user.id} | ${user.username ?? "[null]"} | ${user.role} | password=${user.passwordHash ? "set" : "null"} | ${user.createdAt.toISOString()}`,
      );
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

