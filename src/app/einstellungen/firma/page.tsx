import FirmaPageClient from "./firma-page-client";

import { getCurrentOrgKey, ensureOrganization } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FirmaSettingsPage() {
  const prisma = getPrismaClient();

  if (!prisma) {
    return <FirmaPageClient initialOrganization={null} />;
  }

  const orgKey = await getCurrentOrgKey();
  const organization = await ensureOrganization(orgKey);

  return <FirmaPageClient initialOrganization={organization} />;
}
