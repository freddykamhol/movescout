import "dotenv/config";

import crypto from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
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

function normalizeUsername(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.toLowerCase().replace(/[^a-z0-9._-]+/g, "");
}

function printHelp() {
  // Intentionally minimal; this is an ops/helper command.
  console.log(`
Create (or update) an admin user in the MoveScout database.

Usage:
  npm run admin:create -- --username Admin --password "..." [--orgKey org_default]

Options:
  --orgKey <key>         Organization key (default: MOVESCOUT_DEFAULT_ORG_KEY or "org_default")
  --username <name>      Required (will be normalized to lowercase)
  --password <pw>        Optional (if omitted, a random password is generated and printed once)
  --displayName <name>   Optional (default: "Administrator")
  --email <email>        Optional
  --role <role>          Optional (OWNER|ADMIN|MEMBER|VIEWER), default: OWNER
  --help                 Show this help
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
  const usernameRaw = getStringArg(args, "username");
  const username = normalizeUsername(usernameRaw);

  if (!username) {
    console.error("Missing --username.");
    printHelp();
    process.exitCode = 2;
    return;
  }

  const roleRaw = (getStringArg(args, "role", "OWNER") || "OWNER").trim().toUpperCase();
  const role = (["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const).includes(roleRaw as never) ? (roleRaw as never) : "OWNER";

  const displayName = getStringArg(args, "displayName", "Administrator") || "Administrator";
  const email = getStringArg(args, "email") || undefined;

  const databaseUrl = getDatabaseUrlFromEnv();
  if (!databaseUrl) {
    console.error("Missing database connection string. Set DATABASE_URL (or PRISMA_DATABASE_URL / POSTGRES_URL).");
    process.exitCode = 2;
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  let plainPassword = getStringArg(args, "password");
  const generatedPassword = !plainPassword;
  if (!plainPassword) {
    plainPassword = crypto.randomBytes(18).toString("base64url");
  }

  try {
    await prisma.organization.upsert({
      where: { orgKey },
      update: {},
      create: { orgKey, name: "MoveScout Organisation" },
    });

    const existing = await prisma.user.findFirst({
      where: { orgKey, username: { equals: username, mode: "insensitive" } },
    });

    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { username, passwordHash, displayName, email, role },
        })
      : await prisma.user.create({
          data: { orgKey, username, passwordHash, displayName, email, role },
        });

    console.log(`${existing ? "Updated" : "Created"} user: ${user.id}`);
    console.log(`orgKey: ${orgKey}`);
    console.log(`username: ${user.username}`);
    console.log(`role: ${user.role}`);
    if (generatedPassword) {
      console.log(`password: ${plainPassword}`);
    } else {
      console.log("password: [set]");
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

