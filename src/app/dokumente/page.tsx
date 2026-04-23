import DocumentsPageClient from "./documents-page-client";

import { getDocumentLibraryData } from "@/lib/documents-data";

export const dynamic = "force-dynamic";

export default async function DokumentePage() {
  const customers = await getDocumentLibraryData();

  return <DocumentsPageClient initialCustomers={customers} />;
}
