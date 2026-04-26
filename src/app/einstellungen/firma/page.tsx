import FirmaPageClient from "./firma-page-client";

import { getCurrentOrgKey, ensureOrganization } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FirmaSettingsPage() {
  let initialOrganization = null;

  try {
    const prisma = getPrismaClient();

    if (prisma) {
      const orgKey = await getCurrentOrgKey();
      initialOrganization = await ensureOrganization(orgKey);
    }
  } catch {
    // fallback
  }

  return <FirmaPageClient initialOrganization={initialOrganization} />;
}
