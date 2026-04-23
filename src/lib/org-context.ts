import "server-only";

import { cookies, headers } from "next/headers";

import type { Organization } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";

const orgCookieName = "movescout_org";

export type OrgContext = {
  orgKey: string;
};

export function getDefaultOrgKey() {
  return process.env.MOVESCOUT_DEFAULT_ORG_KEY?.trim() || "org_default";
}

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }

  const map = new Map<string, string>();

  cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const equalIndex = part.indexOf("=");
      if (equalIndex <= 0) {
        return;
      }
      const key = part.slice(0, equalIndex).trim();
      const value = part.slice(equalIndex + 1).trim();
      map.set(key, decodeURIComponent(value));
    });

  return map;
}

export function getOrgKeyFromRequest(request: Request) {
  const headerOrgKey = request.headers.get("x-org-key")?.trim();
  if (headerOrgKey) {
    return headerOrgKey;
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const cookieOrgKey = cookies.get(orgCookieName)?.trim();
  if (cookieOrgKey) {
    return cookieOrgKey;
  }

  return getDefaultOrgKey();
}

export async function getCurrentOrgKey() {
  const headerOrgKey = (await headers()).get("x-org-key")?.trim();
  if (headerOrgKey) {
    return headerOrgKey;
  }

  const cookieOrgKey = (await cookies()).get(orgCookieName)?.value?.trim();
  if (cookieOrgKey) {
    return cookieOrgKey;
  }

  return getDefaultOrgKey();
}

export async function ensureOrganization(orgKey: string) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return null;
  }

  const organizationDelegate = (prisma as unknown as {
    organization?: { upsert: (args: unknown) => Promise<Organization> };
  }).organization;
  if (!organizationDelegate?.upsert) {
    console.warn("PrismaClient hat kein Organization-Model geladen (vermutlich alter Dev-Cache). Bitte Dev-Server neu starten.");
    return null;
  }

  return organizationDelegate.upsert({
    create: {
      orgKey,
      name: "MoveScout Organisation",
    },
    update: {},
    where: {
      orgKey,
    },
  });
}

export async function ensureDefaultOrganization() {
  return ensureOrganization(getDefaultOrgKey());
}
