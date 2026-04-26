import PreisePageClient from "./preise-page-client";

import { furnitureCategories } from "@/lib/furniture-categories";
import { furnitureCatalog } from "@/lib/furniture-catalog";
import { getCurrentOrgKey } from "@/lib/org-context";
import { getStoredMovePricingConfig } from "@/lib/move-pricing-store";
import { defaultMovePricingConfig } from "@/lib/move-pricing";

export const dynamic = "force-dynamic";

export default async function PreiseSettingsPage() {
  let initialPricingConfig = defaultMovePricingConfig;
  let furnitureCategoryGroups: Array<{ id: string; items: string[]; label: string }> = [];

  try {
    const orgKey = await getCurrentOrgKey();
    initialPricingConfig = await getStoredMovePricingConfig(orgKey);
    furnitureCategoryGroups = furnitureCategories
      .map((category) => ({
        id: category.id,
        label: category.label,
        items: furnitureCatalog
          .filter((catalogItem) => catalogItem.category === category.id)
          .map((catalogItem) => catalogItem.furnitureName),
      }))
      .filter((categoryGroup) => categoryGroup.items.length > 0);
  } catch {
    // fallback
  }

  return <PreisePageClient furnitureCategoryGroups={furnitureCategoryGroups} initialPricingConfig={initialPricingConfig} />;
}
