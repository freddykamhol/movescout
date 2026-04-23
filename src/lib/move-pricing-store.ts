import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { defaultMovePricingConfig, normalizeMovePricingConfig, type MovePricingConfig } from "@/lib/move-pricing";
import { getDefaultOrgKey } from "@/lib/org-context";

function getMovePricingConfigPath(orgKey: string) {
  return path.join(process.cwd(), "prisma", "data", "orgs", orgKey, "move-pricing-config.json");
}

const legacyMovePricingConfigPath = path.join(process.cwd(), "prisma", "data", "move-pricing-config.json");

export async function getStoredMovePricingConfig(orgKey?: string) {
  const resolvedOrgKey = orgKey?.trim() || getDefaultOrgKey();
  const movePricingConfigPath = getMovePricingConfigPath(resolvedOrgKey);
  try {
    const rawConfig = await readFile(movePricingConfigPath, "utf8");
    return normalizeMovePricingConfig(JSON.parse(rawConfig) as Partial<MovePricingConfig>);
  } catch {
    if (resolvedOrgKey === getDefaultOrgKey()) {
      try {
        const rawLegacyConfig = await readFile(legacyMovePricingConfigPath, "utf8");
        const normalizedConfig = normalizeMovePricingConfig(JSON.parse(rawLegacyConfig) as Partial<MovePricingConfig>);
        await mkdir(path.dirname(movePricingConfigPath), { recursive: true });
        await writeFile(movePricingConfigPath, `${JSON.stringify(normalizedConfig, null, 2)}\n`, "utf8");
        return normalizedConfig;
      } catch {
        // ignore legacy fallback
      }
    }

    return defaultMovePricingConfig;
  }
}

export async function saveStoredMovePricingConfig(orgKey: string, config: Partial<MovePricingConfig>) {
  const resolvedOrgKey = orgKey.trim() || getDefaultOrgKey();
  const movePricingConfigPath = getMovePricingConfigPath(resolvedOrgKey);
  const normalizedConfig = normalizeMovePricingConfig(config);

  await mkdir(path.dirname(movePricingConfigPath), { recursive: true });
  await writeFile(movePricingConfigPath, `${JSON.stringify(normalizedConfig, null, 2)}\n`, "utf8");

  return normalizedConfig;
}
