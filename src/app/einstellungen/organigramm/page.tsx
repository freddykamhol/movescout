import OrganigrammPageClient from "./organigramm-page-client";

import { getCurrentOrgKey, ensureOrganization } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OrganigrammSettingsPage() {
  const prisma = getPrismaClient();

  if (!prisma) {
    return <OrganigrammPageClient initialNodes={[]} />;
  }

  const orgKey = await getCurrentOrgKey();
  await ensureOrganization(orgKey);

  const nodes = await prisma.orgChartNode.findMany({
    where: { orgKey },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return <OrganigrammPageClient initialNodes={nodes} />;
}
