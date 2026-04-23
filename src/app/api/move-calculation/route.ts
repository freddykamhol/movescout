import { NextResponse } from "next/server";

import {
  calculateMovePricing,
  calculateOptimizedStopOrder,
  formatMoveAddressLabel,
  getMoveCalculationReadiness,
  haversineDistanceKilometers,
  roundDistance,
  type Coordinate,
  type MoveCalculationAddressInput,
  type MoveCalculationErrorResponse,
  type MoveCalculationRateLimitedResponse,
  type MoveCalculationReadyResponse,
  type MoveCalculationRequest,
  type MoveCalculationRoutePoint,
} from "@/lib/move-calculation";
import { ensureOrganization, getOrgKeyFromRequest } from "@/lib/org-context";
import { getStoredMovePricingConfig } from "@/lib/move-pricing-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GeocodingApiResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

type GeocodedAddress = {
  coordinate: Coordinate;
  input: MoveCalculationAddressInput;
  label: string;
};

type OsrmRouteApiResponse = {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
  }>;
};

const defaultGeocodingBaseUrl = "https://nominatim.openstreetmap.org/search";
const defaultRoutingBaseUrl = "https://router.project-osrm.org/route/v1/driving";

type GeocodeCacheEntry = {
  expiresAt: number;
  value: GeocodedAddress | null;
};

declare global {
  var __movescoutGeocodeCache: Map<string, GeocodeCacheEntry> | undefined;
  var __movescoutGeocodeInFlight: Map<string, Promise<GeocodedAddress | null>> | undefined;
  var __movescoutGeocodeNextAllowedAt: number | undefined;
}

const geocodeCache = globalThis.__movescoutGeocodeCache ?? (globalThis.__movescoutGeocodeCache = new Map());
const geocodeInFlight = globalThis.__movescoutGeocodeInFlight ?? (globalThis.__movescoutGeocodeInFlight = new Map());

class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getGeocodingBaseUrl() {
  return process.env.MOVESCOUT_GEOCODING_URL?.trim() || defaultGeocodingBaseUrl;
}

function getRoutingBaseUrl() {
  return process.env.MOVESCOUT_ROUTING_URL?.trim() || defaultRoutingBaseUrl;
}

function getGeocodingUserAgent() {
  return (
    process.env.MOVESCOUT_GEOCODING_USER_AGENT?.trim() ||
    "MoveScout/1.0 (https://movescout.local; contact: dev@movescout.local)"
  );
}

function isDefaultNominatim(url: string) {
  return url.includes("nominatim.openstreetmap.org");
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleGeocodingRequests(baseUrl: string) {
  // Nominatim public endpoint: be gentle and avoid bursts (policy is ~1 req/sec).
  if (!isDefaultNominatim(baseUrl)) {
    return;
  }

  const now = Date.now();
  const nextAllowedAt = globalThis.__movescoutGeocodeNextAllowedAt ?? 0;
  if (nextAllowedAt > now) {
    await sleep(nextAllowedAt - now);
  }

  globalThis.__movescoutGeocodeNextAllowedAt = Date.now() + 1100;
}

function buildGeocodingQuery(address: MoveCalculationAddressInput) {
  return [address.street.trim(), address.houseNumber.trim(), address.postalCode.trim(), address.city.trim()]
    .filter(Boolean)
    .join(" ");
}

async function geocodeAddress(address: MoveCalculationAddressInput): Promise<GeocodedAddress | null> {
  const baseUrl = getGeocodingBaseUrl();
  const query = buildGeocodingQuery(address);
  const cacheKey = `${baseUrl}|${query.trim().toLowerCase()}`;
  const cached = geocodeCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const existingInFlight = geocodeInFlight.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const task = (async () => {
    await throttleGeocodingRequests(baseUrl);

  const searchParams = new URLSearchParams({
    addressdetails: "0",
    format: "jsonv2",
    limit: "1",
      q: query,
  });

    const response = await fetch(`${baseUrl}?${searchParams.toString()}`, {
    cache: "no-store",
    headers: {
      "accept-language": "de",
        "user-agent": getGeocodingUserAgent(),
    },
  });

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = Math.min(60, Math.max(2, retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : 2));
      throw new RateLimitError("Geocoding fehlgeschlagen (429). Bitte kurz warten.", retryAfterSeconds);
    }

    if (!response.ok) {
      throw new Error(`Geocoding fehlgeschlagen (${response.status}).`);
  }

    const results = (await response.json()) as GeocodingApiResult[];
    const bestResult = results[0];

    if (!bestResult?.lat || !bestResult.lon) {
      return null;
  }

    const latitude = Number(bestResult.lat);
    const longitude = Number(bestResult.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
  }

    return {
    coordinate: {
      latitude,
      longitude,
    },
    input: address,
    label: formatMoveAddressLabel(address),
  };
  })()
    .then((value) => {
      geocodeCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + (value ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 6),
      });
      return value;
    })
    .finally(() => {
      geocodeInFlight.delete(cacheKey);
    });

  geocodeInFlight.set(cacheKey, task);
  return task;
}

function toRoutePoint(address: MoveCalculationAddressInput): MoveCalculationRoutePoint {
  return {
    ...address,
    label: formatMoveAddressLabel(address),
  };
}

function calculateFallbackRouteDistanceKilometers(routePoints: GeocodedAddress[]) {
  let totalDistanceKilometers = 0;

  for (let routePointIndex = 0; routePointIndex < routePoints.length - 1; routePointIndex += 1) {
    totalDistanceKilometers += haversineDistanceKilometers(
      routePoints[routePointIndex].coordinate,
      routePoints[routePointIndex + 1].coordinate,
    );
  }

  return roundDistance(totalDistanceKilometers);
}

async function fetchRoadRoute(routePoints: GeocodedAddress[]) {
  const coordinates = routePoints
    .map((routePoint) => `${routePoint.coordinate.longitude},${routePoint.coordinate.latitude}`)
    .join(";");
  const searchParams = new URLSearchParams({
    alternatives: "false",
    geometries: "geojson",
    overview: "false",
    steps: "false",
  });
  const response = await fetch(`${getRoutingBaseUrl()}/${coordinates}?${searchParams.toString()}`, {
    cache: "no-store",
    headers: {
      "user-agent": "MoveScout/1.0",
    },
  });

  if (response.status === 429) {
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = Math.min(60, Math.max(2, retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : 2));
    throw new RateLimitError("Routing fehlgeschlagen (429). Bitte kurz warten.", retryAfterSeconds);
  }

  if (!response.ok) {
    throw new Error(`Routing fehlgeschlagen (${response.status}).`);
  }

  const payload = (await response.json()) as OsrmRouteApiResponse;
  const bestRoute = payload.routes?.[0];

  if (payload.code !== "Ok" || typeof bestRoute?.distance !== "number") {
    throw new Error("Der Routingdienst hat keine passende Strecke gefunden.");
  }

  return {
    distanceKilometers: roundDistance(bestRoute.distance / 1000),
    distanceMeters: Math.round(bestRoute.distance),
    durationMinutes: typeof bestRoute.duration === "number" ? Math.round(bestRoute.duration / 60) : null,
    durationSeconds: typeof bestRoute.duration === "number" ? Math.round(bestRoute.duration) : null,
  };
}

function buildOrderedRoutePoints(sanitizedRequest: MoveCalculationRequest, stopOrder: number[]) {
  const orderedStops = stopOrder.map((stopIndex, orderedIndex) => ({
    ...toRoutePoint(sanitizedRequest.stopAddresses[stopIndex]),
    orderedIndex,
    originalIndex: stopIndex,
  }));
  const orderedRoute = [
    toRoutePoint(sanitizedRequest.moveOutAddress),
    ...orderedStops,
    toRoutePoint(sanitizedRequest.moveInAddress),
  ];

  return {
    orderedRoute,
    orderedStops,
  };
}

function createErrorResponse(message: string, status = 500) {
  return NextResponse.json<MoveCalculationErrorResponse>(
    {
      message,
      status: "error",
    },
    { status },
  );
}

function createRateLimitedResponse(message: string, retryAfterSeconds: number, warnings: string[] = []) {
  return NextResponse.json<MoveCalculationRateLimitedResponse>(
    {
      message,
      retryAfterSeconds,
      status: "rate_limited",
      warnings,
    },
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const orgKey = getOrgKeyFromRequest(request);
  await ensureOrganization(orgKey);

  let payload: MoveCalculationRequest;

  try {
    payload = (await request.json()) as MoveCalculationRequest;
  } catch {
    return createErrorResponse("Die API erwartet JSON mit Auszug, Zwischenstopps und Einzug.", 400);
  }

  const readiness = getMoveCalculationReadiness(payload);

  if (!readiness.isReady) {
    return NextResponse.json(
      {
        message: "Bitte zuerst alle benötigten Adressen vollständig erfassen.",
        status: "insufficient_address",
        warnings: readiness.warnings,
      },
      { status: 200 },
    );
  }

  const sanitizedRequest = readiness.sanitizedRequest;

  try {
    const moveOutAddress = await geocodeAddress(sanitizedRequest.moveOutAddress);
    const moveInAddress = await geocodeAddress(sanitizedRequest.moveInAddress);

    if (!moveOutAddress) {
      return createErrorResponse("Die Auszugsadresse konnte nicht gefunden werden.", 422);
    }

    if (!moveInAddress) {
      return createErrorResponse("Die Einzugsadresse konnte nicht gefunden werden.", 422);
    }

    const stopAddresses: GeocodedAddress[] = [];
    for (let stopIndex = 0; stopIndex < sanitizedRequest.stopAddresses.length; stopIndex += 1) {
      const stopAddress = sanitizedRequest.stopAddresses[stopIndex];
      const geocodedStopAddress = await geocodeAddress(stopAddress);

      if (!geocodedStopAddress) {
        throw new Error(`Zwischenstopp ${stopIndex + 1} konnte nicht gefunden werden.`);
      }

      stopAddresses.push(geocodedStopAddress);
    }

    const optimizedStopOrder = calculateOptimizedStopOrder(
      moveOutAddress.coordinate,
      stopAddresses.map((stopAddress) => stopAddress.coordinate),
      moveInAddress.coordinate,
    );
    const orderedRoutePoints = [
      moveOutAddress,
      ...optimizedStopOrder.map((stopIndex) => stopAddresses[stopIndex]),
      moveInAddress,
    ];
    const orderedRoute = buildOrderedRoutePoints(sanitizedRequest, optimizedStopOrder);
    const routeWarnings: string[] = [];

    let routeData: MoveCalculationReadyResponse["route"];
    let provider: MoveCalculationReadyResponse["provider"] = "osrm";

    try {
      routeData = await fetchRoadRoute(orderedRoutePoints);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return createRateLimitedResponse(error.message, error.retryAfterSeconds, readiness.warnings);
      }
      provider = "haversine-fallback";
      const fallbackDistanceKilometers = calculateFallbackRouteDistanceKilometers(orderedRoutePoints);

      routeWarnings.push("Routingdienst aktuell nicht erreichbar. Die Strecke basiert daher auf einer Luftlinien-Näherung.");
      routeData = {
        distanceKilometers: fallbackDistanceKilometers,
        distanceMeters: Math.round(fallbackDistanceKilometers * 1000),
        durationMinutes: null,
        durationSeconds: null,
      };
    }

    const allAddresses = [
      sanitizedRequest.moveOutAddress,
      ...orderedRoute.orderedStops.map((stopAddress) => stopAddress),
      sanitizedRequest.moveInAddress,
    ];
    const pricingConfig = await getStoredMovePricingConfig(orgKey);
    const pricing = calculateMovePricing(
      routeData.distanceKilometers,
      allAddresses,
      sanitizedRequest.furnitureSelections,
      pricingConfig,
    );

    return NextResponse.json<MoveCalculationReadyResponse>({
      message: "Route und Preis wurden erfolgreich berechnet.",
      orderedRoute: orderedRoute.orderedRoute,
      orderedStops: orderedRoute.orderedStops,
      pricing,
      provider,
      route: routeData,
      status: "ready",
      warnings: routeWarnings,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return createRateLimitedResponse(error.message, error.retryAfterSeconds, readiness.warnings);
    }

    if (error instanceof Error) {
      return createErrorResponse(error.message, 422);
    }

    return createErrorResponse("Die Route konnte gerade nicht berechnet werden.");
  }
}
