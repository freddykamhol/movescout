import { NextResponse } from "next/server";

import { decryptStringForOrg } from "@/lib/crypto/data-encryption";
import { getCompanyLocationHash, getEmailHash, getPersonLocationHash } from "@/lib/crypto/pii-hash";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getPrismaClient } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LookupPayload = {
  address?: string;
  city?: string;
  company?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  postalCode?: string;
};

function sanitize(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  const prisma = getPrismaClient();
  if (!prisma) {
    return NextResponse.json({ message: "Datenbank ist nicht verfügbar." }, { status: 503 });
  }
  const prismaClient = prisma;

  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: LookupPayload;

  try {
    payload = (await request.json()) as LookupPayload;
  } catch {
    return NextResponse.json({ message: "Die API erwartet JSON." }, { status: 400 });
  }

  const email = sanitize(payload.email).toLowerCase();
  const company = sanitize(payload.company);
  const firstName = sanitize(payload.firstName);
  const lastName = sanitize(payload.lastName);
  const postalCode = sanitize(payload.postalCode);
  const city = sanitize(payload.city);
  const address = sanitize(payload.address);

  async function backfillAndReturn(customer: {
    id: string;
    customerNumber: string;
    company: string | null;
    firstName: string;
    lastName: string;
    address: string;
    postalCode: string;
    city: string;
  }) {
    const decrypted = {
      company: customer.company ? decryptStringForOrg(orgKey, customer.company) : null,
      firstName: decryptStringForOrg(orgKey, customer.firstName),
      lastName: decryptStringForOrg(orgKey, customer.lastName),
      address: decryptStringForOrg(orgKey, customer.address),
      postalCode: decryptStringForOrg(orgKey, customer.postalCode),
      city: decryptStringForOrg(orgKey, customer.city),
    };

    // Best-effort backfill so the next lookup is fast.
    try {
      await prismaClient.customer.update({
        where: { id: customer.id },
        data: {
          emailHash: getEmailHash(email),
          companyLocationHash: getCompanyLocationHash(decrypted.company, decrypted.postalCode, decrypted.city),
          personLocationHash: getPersonLocationHash(decrypted.firstName, decrypted.lastName, decrypted.postalCode, decrypted.city, decrypted.address),
        },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      customer: {
        ...customer,
        ...decrypted,
      },
    });
  }

  // Priority 1: E-Mail is the strongest signal.
  if (email) {
    const emailHash = getEmailHash(email);
    if (!emailHash) {
      return NextResponse.json({ customer: null });
    }
    const customer = await prismaClient.customer.findFirst({
      select: {
        id: true,
        customerNumber: true,
        company: true,
        firstName: true,
        lastName: true,
        address: true,
        postalCode: true,
        city: true,
      },
      where: {
        orgKey,
        emailHash,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (customer) return backfillAndReturn(customer);

    // Transitional fallback: scan recent customers (works for legacy plaintext rows).
    const candidates = await prismaClient.customer.findMany({
      select: {
        id: true,
        customerNumber: true,
        company: true,
        firstName: true,
        lastName: true,
        address: true,
        postalCode: true,
        city: true,
        email: true,
      },
      where: { orgKey },
      orderBy: { updatedAt: "desc" },
      take: 1500,
    });

    const emailNorm = normalize(email);
    const match = candidates.find((candidate) => normalize(decryptStringForOrg(orgKey, candidate.email)) === emailNorm);
    if (!match) return NextResponse.json({ customer: null });

    return backfillAndReturn(match);
  }

  // Priority 2: Firmenkunde mit PLZ/Ort.
  if (company && postalCode && city) {
    const hash = getCompanyLocationHash(company, postalCode, city);
    if (!hash) return NextResponse.json({ customer: null });
    const customer = await prismaClient.customer.findFirst({
      select: {
        id: true,
        customerNumber: true,
        company: true,
        firstName: true,
        lastName: true,
        address: true,
        postalCode: true,
        city: true,
      },
      where: {
        orgKey,
        companyLocationHash: hash,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (customer) return backfillAndReturn(customer);

    const candidates = await prismaClient.customer.findMany({
      select: {
        id: true,
        customerNumber: true,
        company: true,
        firstName: true,
        lastName: true,
        address: true,
        postalCode: true,
        city: true,
      },
      where: { orgKey },
      orderBy: { updatedAt: "desc" },
      take: 1500,
    });

    const companyNorm = normalize(company);
    const postalNorm = normalize(postalCode);
    const cityNorm = normalize(city);
    const match = candidates.find((candidate) => {
      const decodedCompany = candidate.company ? decryptStringForOrg(orgKey, candidate.company) : "";
      return normalize(decodedCompany) === companyNorm && normalize(decryptStringForOrg(orgKey, candidate.postalCode)) === postalNorm && normalize(decryptStringForOrg(orgKey, candidate.city)) === cityNorm;
    });

    if (!match) return NextResponse.json({ customer: null });
    return backfillAndReturn(match);
  }

  // Priority 3: Privatkunde mit Name + Adresse (Ort/PLZ).
  if (firstName && lastName && postalCode && city) {
    const hash = getPersonLocationHash(firstName, lastName, postalCode, city, address);
    if (!hash) return NextResponse.json({ customer: null });
    const customer = await prismaClient.customer.findFirst({
      select: {
        id: true,
        customerNumber: true,
        company: true,
        firstName: true,
        lastName: true,
        address: true,
        postalCode: true,
        city: true,
      },
      where: {
        orgKey,
        personLocationHash: hash,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (customer) return backfillAndReturn(customer);

    const candidates = await prismaClient.customer.findMany({
      select: {
        id: true,
        customerNumber: true,
        company: true,
        firstName: true,
        lastName: true,
        address: true,
        postalCode: true,
        city: true,
      },
      where: { orgKey },
      orderBy: { updatedAt: "desc" },
      take: 1500,
    });

    const firstNorm = normalize(firstName);
    const lastNorm = normalize(lastName);
    const postalNorm = normalize(postalCode);
    const cityNorm = normalize(city);
    const addressNorm = normalize(address);

    const match = candidates.find((candidate) => {
      const decodedFirst = decryptStringForOrg(orgKey, candidate.firstName);
      const decodedLast = decryptStringForOrg(orgKey, candidate.lastName);
      const decodedPostal = decryptStringForOrg(orgKey, candidate.postalCode);
      const decodedCity = decryptStringForOrg(orgKey, candidate.city);
      const decodedAddress = decryptStringForOrg(orgKey, candidate.address);
      if (normalize(decodedFirst) !== firstNorm) return false;
      if (normalize(decodedLast) !== lastNorm) return false;
      if (normalize(decodedPostal) !== postalNorm) return false;
      if (normalize(decodedCity) !== cityNorm) return false;
      if (addressNorm && normalize(decodedAddress) !== addressNorm) return false;
      return true;
    });

    if (!match) return NextResponse.json({ customer: null });
    return backfillAndReturn(match);
  }

  return NextResponse.json({ customer: null });
}
