import { NextResponse } from "next/server";

import { getDocumentLibraryData } from "@/lib/documents-data";
import { getOrgKeyFromRequest } from "@/lib/org-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  const customers = await getDocumentLibraryData(orgKey);
  return NextResponse.json({ customers });
}
