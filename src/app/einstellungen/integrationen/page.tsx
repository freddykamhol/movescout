import IntegrationenPageClient from "./integrationen-page-client";

import { getCurrentOrgKey, ensureOrganization } from "@/lib/org-context";
import { getIntegrationSettingsForOrg } from "@/lib/integration-settings";

export const dynamic = "force-dynamic";

export default async function IntegrationenSettingsPage() {
  const orgKey = await getCurrentOrgKey();
  await ensureOrganization(orgKey);
  const settings = await getIntegrationSettingsForOrg(orgKey);
  return <IntegrationenPageClient initialSettings={settings} />;
}

