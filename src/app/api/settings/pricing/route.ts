import { NextResponse } from "next/server";

import { type MovePricingConfig } from "@/lib/move-pricing";
import { getStoredMovePricingConfig, saveStoredMovePricingConfig } from "@/lib/move-pricing-store";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);
  const pricingConfig = await getStoredMovePricingConfig(orgKey);

  return NextResponse.json({
    pricingConfig,
  });
}

export async function PUT(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: Partial<MovePricingConfig>;

  try {
    payload = (await request.json()) as Partial<MovePricingConfig>;
  } catch {
    return NextResponse.json(
      {
        message: "Die API erwartet JSON mit Preisfeldern.",
      },
      { status: 400 },
    );
  }

  const pricingConfig = await saveStoredMovePricingConfig(orgKey, payload);

  return NextResponse.json({
    message: "Preise wurden gespeichert.",
    pricingConfig,
    savedAt: new Date().toISOString(),
  });
}
