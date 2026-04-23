import { NextResponse } from "next/server";

import { getIntegrationSettingsForOrg, updateIntegrationSettingsForOrg, type UpdateIntegrationSettingsPayload } from "@/lib/integration-settings";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);
  const settings = await getIntegrationSettingsForOrg(orgKey);
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  const payload = await readJson<UpdateIntegrationSettingsPayload>(request);
  if (!payload) {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const updated = await updateIntegrationSettingsForOrg(orgKey, payload);
  if (!updated) {
    return NextResponse.json({ message: "Einstellungen konnten nicht gespeichert werden." }, { status: 503 });
  }

  const settings = await getIntegrationSettingsForOrg(orgKey);
  return NextResponse.json({ message: "Integrationen wurden gespeichert.", settings });
}

