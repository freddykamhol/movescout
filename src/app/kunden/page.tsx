import KundenPageClient from "./kunden-page-client";

import { getCustomerTableData } from "@/lib/customer-data";

export const dynamic = "force-dynamic";

export default async function KundenPage() {
  const customers = await getCustomerTableData();

  return <KundenPageClient initialCustomers={customers} />;
}
