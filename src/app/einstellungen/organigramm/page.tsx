import OrganigrammPageClient from "./organigramm-page-client";

import type { OrgChartNode } from "@/generated/prisma/client";
import { getCurrentOrgKey, ensureOrganization } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OrganigrammSettingsPage() {
  let initialNodes: OrgChartNode[] = [];

  try {
    const prisma = getPrismaClient();

    if (prisma) {
      const orgKey = await getCurrentOrgKey();
      await ensureOrganization(orgKey);

      initialNodes = await prisma.orgChartNode.findMany({
        where: { orgKey },
        orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      });
    }
  } catch {
    // fallback
  }

  return <OrganigrammPageClient initialNodes={initialNodes} />;
}
