import BenutzerPageClient from "./benutzer-page-client";

import { getCurrentOrgKey, ensureOrganization } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BenutzerSettingsPage() {
  const prisma = getPrismaClient();

  if (!prisma) {
    return <BenutzerPageClient initialUsers={[]} />;
  }

  const orgKey = await getCurrentOrgKey();
  await ensureOrganization(orgKey);
  const users = await prisma.user.findMany({
    where: { orgKey },
    orderBy: [{ role: "asc" }, { displayName: "asc" }],
  });

  return <BenutzerPageClient initialUsers={users} />;
}
