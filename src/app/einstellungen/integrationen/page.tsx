import IntegrationenPageClient from "./integrationen-page-client";

import { getCurrentOrgKey, ensureOrganization } from "@/lib/org-context";
import { getIntegrationSettingsForOrg } from "@/lib/integration-settings";

export const dynamic = "force-dynamic";

export default async function IntegrationenSettingsPage() {
  let initialSettings = null;

  try {
    const orgKey = await getCurrentOrgKey();
    await ensureOrganization(orgKey);
    initialSettings = await getIntegrationSettingsForOrg(orgKey);
  } catch {
    // fallback
  }

  return <IntegrationenPageClient initialSettings={initialSettings} />;
}
