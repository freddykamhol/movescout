import PreisePageClient from "./preise-page-client";

import { furnitureCategories } from "@/lib/furniture-categories";
import { furnitureCatalog } from "@/lib/furniture-catalog";
import { getCurrentOrgKey } from "@/lib/org-context";
import { getStoredMovePricingConfig } from "@/lib/move-pricing-store";

export const dynamic = "force-dynamic";

export default async function PreiseSettingsPage() {
  const orgKey = await getCurrentOrgKey();
  const initialPricingConfig = await getStoredMovePricingConfig(orgKey);
  const furnitureCategoryGroups = furnitureCategories
    .map((category) => ({
      id: category.id,
      label: category.label,
      items: furnitureCatalog
        .filter((catalogItem) => catalogItem.category === category.id)
        .map((catalogItem) => catalogItem.furnitureName),
    }))
    .filter((categoryGroup) => categoryGroup.items.length > 0);

  return (
    <PreisePageClient
      furnitureCategoryGroups={furnitureCategoryGroups}
      initialPricingConfig={initialPricingConfig}
    />
  );
}
