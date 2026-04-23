import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { resolvePrismaDatabaseUrls } from "@/lib/prisma-database-url";

const globalForPrisma = globalThis as typeof globalThis & {
  prismaConnectionString?: string;
  prismaClientSignature?: string;
  prisma?: PrismaClient;
  prismaPool?: Pool;
};

// When Prisma schema changes, an old PrismaClient instance can survive HMR in dev (stored on globalThis),
// but it won't have the new model delegates (e.g. `prisma.organization`). We force a re-init when this changes.
const prismaClientSignature = "movescout-prisma-schema-orgkey-v1";

export function getPrismaClient() {
  const resolvedDatabaseUrls = resolvePrismaDatabaseUrls(process.env.DATABASE_URL);
  const connectionString = resolvedDatabaseUrls?.databaseUrl;

  if (!connectionString) {
    return null;
  }

  if (
    globalForPrisma.prismaConnectionString !== connectionString ||
    globalForPrisma.prismaClientSignature !== prismaClientSignature
  ) {
    void globalForPrisma.prismaPool?.end().catch(() => undefined);
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaPool = undefined;
    globalForPrisma.prismaConnectionString = connectionString;
    globalForPrisma.prismaClientSignature = prismaClientSignature;
  }

  if (!globalForPrisma.prismaPool) {
    globalForPrisma.prismaPool = new Pool({
      connectionString,
    });
  }

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg(globalForPrisma.prismaPool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.prisma;
}
