import BenutzerPageClient from "./benutzer-page-client";

import { getCurrentOrgKey, ensureOrganization } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BenutzerSettingsPage() {
  let initialUsers = [];

  try {
    const prisma = getPrismaClient();

    if (prisma) {
      const orgKey = await getCurrentOrgKey();
      await ensureOrganization(orgKey);
      initialUsers = await prisma.user.findMany({
        where: { orgKey },
        orderBy: [{ role: "asc" }, { displayName: "asc" }],
      });
    }
  } catch {
    // fallback
  }

  return <BenutzerPageClient initialUsers={initialUsers} />;
}
