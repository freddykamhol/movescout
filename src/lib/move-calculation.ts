import { defaultMovePricingConfig, type MovePricingConfig } from "@/lib/move-pricing";

export const movePricingConfig = defaultMovePricingConfig;

export type MoveCalculationAddressKind = "move-in" | "move-out" | "stop";

export type MoveCalculationAddressInput = {
  city: string;
  floor?: string;
  hasElevator?: boolean;
  hasNoParkingZone?: boolean;
  houseNumber: string;
  id: string;
  kind: MoveCalculationAddressKind;
  postalCode: string;
  street: string;
  walkingDistanceMeters?: number | string | null;
};

export type MoveCalculationFurnitureInput = {
  furnitureName: string;
  heightCm?: number | string | null;
  id: string;
  isAssembly?: boolean;
  isDisassembly?: boolean;
  isDisposal?: boolean;
  lengthCm?: number | string | null;
  widthCm?: number | string | null;
};

export type MoveCalculationRequest = {
  furnitureSelections: MoveCalculationFurnitureInput[];
  moveInAddress: MoveCalculationAddressInput;
  moveOutAddress: MoveCalculationAddressInput;
  stopAddresses: MoveCalculationAddressInput[];
};

export type MoveCalculationRoutePoint = MoveCalculationAddressInput & {
  label: string;
};

export type MoveCalculationAddressCharge = {
  accessPrice: number;
  addressId: string;
  addressKind: MoveCalculationAddressKind;
  addressLabel: string;
  billableWalkingDistanceMeters: number;
  elevatorPrice: number;
  floorLabel: string;
  floorLevel: number;
  floorPrice: number;
  hasElevator: boolean;
  hasNoParkingZone: boolean;
  noParkingZonePrice: number;
  walkingDistanceMeters: number;
  walkingDistancePrice: number;
  walkingDistanceSteps: number;
};

export type MoveCalculationFurnitureCharge = {
  assemblyPrice: number;
  dimensionsCentimeters: {
    height: number;
    length: number;
    width: number;
  };
  disassemblyPrice: number;
  disposalPrice: number;
  furnitureId: string;
  furnitureName: string;
  isAssembly: boolean;
  isDisassembly: boolean;
  isDisposal: boolean;
  volumeCubicMeters: number;
};

export type MoveCalculationPricing = {
  accessPrice: number;
  addressCharges: MoveCalculationAddressCharge[];
  assemblyPrice: number;
  disassemblyPrice: number;
  distanceKilometers: number;
  distancePrice: number;
  disposalPrice: number;
  disposalVolumeCubicMeters: number;
  elevatorFlatFee: number;
  freeWalkingDistanceMeters: number;
  floorPricePerLevel: number;
  furnitureCharges: MoveCalculationFurnitureCharge[];
  furnitureVolumeCubicMeters: number;
  furnitureVolumeDecimalPrice: number;
  furnitureVolumePrice: number;
  furnitureVolumePricePerCubicMeter: number;
  noParkingZoneFlatFee: number;
  noParkingZonePrice: number;
  pricePerKilometer: number;
  totalPrice: number;
  walkingDistancePrice: number;
  walkingDistanceStepMeters: number;
  walkingDistanceStepPrice: number;
};

export type MoveCalculationOrderedStop = MoveCalculationRoutePoint & {
  orderedIndex: number;
  originalIndex: number;
};

export type MoveCalculationReadyResponse = {
  message: string;
  orderedRoute: MoveCalculationRoutePoint[];
  orderedStops: MoveCalculationOrderedStop[];
  pricing: MoveCalculationPricing;
  provider: "haversine-fallback" | "osrm";
  route: {
    distanceKilometers: number;
    distanceMeters: number;
    durationMinutes: number | null;
    durationSeconds: number | null;
  };
  status: "ready";
  warnings: string[];
};

export type MoveCalculationInsufficientAddressResponse = {
  message: string;
  status: "insufficient_address";
  warnings: string[];
};

export type MoveCalculationRateLimitedResponse = {
  message: string;
  retryAfterSeconds: number;
  status: "rate_limited";
  warnings: string[];
};

export type MoveCalculationErrorResponse = {
  message: string;
  status: "error";
};

export type MoveCalculationResponse =
  | MoveCalculationInsufficientAddressResponse
  | MoveCalculationRateLimitedResponse
  | MoveCalculationReadyResponse;

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export function parseNumericInput(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const normalizedValue = value.trim().replace(",", ".");

  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
}

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundDistance(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundVolume(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function formatMoveAddressLabel(address: Pick<MoveCalculationAddressInput, "city" | "houseNumber" | "postalCode" | "street">) {
  const streetLine = [address.street.trim(), address.houseNumber.trim()].filter(Boolean).join(" ");
  const cityLine = [address.postalCode.trim(), address.city.trim()].filter(Boolean).join(" ");

  if (streetLine && cityLine) {
    return `${streetLine}, ${cityLine}`;
  }

  return streetLine || cityLine || "Adresse offen";
}

export function hasAnyAddressData(address: Pick<MoveCalculationAddressInput, "city" | "houseNumber" | "postalCode" | "street">) {
  return [address.street, address.houseNumber, address.postalCode, address.city].some((value) => value.trim().length > 0);
}

export function hasMinimumRouteAddressData(address: Pick<MoveCalculationAddressInput, "city" | "postalCode" | "street">) {
  return address.street.trim().length > 0 && (address.postalCode.trim().length > 0 || address.city.trim().length > 0);
}

export function sanitizeMoveCalculationRequest(request: MoveCalculationRequest): MoveCalculationRequest {
  return {
    furnitureSelections: (request.furnitureSelections ?? []).map((furnitureSelection) => ({
      ...furnitureSelection,
      heightCm: parseNumericInput(furnitureSelection.heightCm),
      isAssembly: Boolean(furnitureSelection.isAssembly),
      isDisassembly: Boolean(furnitureSelection.isDisassembly),
      isDisposal: Boolean(furnitureSelection.isDisposal),
      lengthCm: parseNumericInput(furnitureSelection.lengthCm),
      widthCm: parseNumericInput(furnitureSelection.widthCm),
    })),
    moveOutAddress: {
      ...request.moveOutAddress,
      floor: request.moveOutAddress.floor ?? "Unbekannt",
      hasElevator: Boolean(request.moveOutAddress.hasElevator),
      hasNoParkingZone: Boolean(request.moveOutAddress.hasNoParkingZone),
      walkingDistanceMeters: parseNumericInput(request.moveOutAddress.walkingDistanceMeters),
    },
    moveInAddress: {
      ...request.moveInAddress,
      floor: request.moveInAddress.floor ?? "Unbekannt",
      hasElevator: Boolean(request.moveInAddress.hasElevator),
      hasNoParkingZone: Boolean(request.moveInAddress.hasNoParkingZone),
      walkingDistanceMeters: parseNumericInput(request.moveInAddress.walkingDistanceMeters),
    },
    stopAddresses: request.stopAddresses
      .filter((address) => hasAnyAddressData(address))
      .map((address) => ({
        ...address,
        floor: address.floor ?? "Unbekannt",
        hasElevator: Boolean(address.hasElevator),
        hasNoParkingZone: Boolean(address.hasNoParkingZone),
        walkingDistanceMeters: parseNumericInput(address.walkingDistanceMeters),
      })),
  };
}

export function getMoveCalculationReadiness(request: MoveCalculationRequest) {
  const sanitizedRequest = sanitizeMoveCalculationRequest(request);
  const warnings: string[] = [];

  if (!hasMinimumRouteAddressData(sanitizedRequest.moveOutAddress)) {
    warnings.push("Die Auszugsadresse braucht mindestens Straße und Ort oder PLZ.");
  }

  if (!hasMinimumRouteAddressData(sanitizedRequest.moveInAddress)) {
    warnings.push("Die Einzugsadresse braucht mindestens Straße und Ort oder PLZ.");
  }

  request.stopAddresses.forEach((address, index) => {
    if (hasAnyAddressData(address) && !hasMinimumRouteAddressData(address)) {
      warnings.push(`Zwischenstopp ${index + 1} ist noch unvollständig.`);
    }
  });

  return {
    isReady: warnings.length === 0,
    sanitizedRequest,
    warnings,
  };
}

function parseFloorLevel(floor: string | null | undefined) {
  if (!floor || floor === "Unbekannt" || floor === "EG") {
    return 0;
  }

  if (floor === "6. OG oder höher") {
    return 6;
  }

  const floorMatch = floor.match(/^(\d+)\.\s*OG$/);

  if (!floorMatch) {
    return 0;
  }

  return Number(floorMatch[1]);
}

function calculateAccessCharge(address: MoveCalculationAddressInput, pricingConfig: MovePricingConfig = movePricingConfig) {
  const floorLevel = parseFloorLevel(address.floor);
  const elevatorPrice = address.hasElevator ? pricingConfig.elevatorFlatFee : 0;
  const floorPrice = !address.hasElevator && floorLevel > 0 ? floorLevel * pricingConfig.floorPricePerLevel : 0;

  return {
    accessPrice: elevatorPrice + floorPrice,
    elevatorPrice,
    floorLabel: address.floor ?? "Unbekannt",
    floorLevel,
    floorPrice,
  };
}

export function calculateWalkingDistanceCharge(
  walkingDistanceMeters: number | string | null | undefined,
  pricingConfig: MovePricingConfig = movePricingConfig,
) {
  const normalizedWalkingDistance = parseNumericInput(walkingDistanceMeters);
  const billableWalkingDistanceMeters = Math.max(0, normalizedWalkingDistance - pricingConfig.freeWalkingDistanceMeters);
  const walkingDistanceSteps =
    billableWalkingDistanceMeters > 0
      ? Math.ceil(billableWalkingDistanceMeters / pricingConfig.walkingDistanceStepMeters)
      : 0;
  const walkingDistancePrice = walkingDistanceSteps * pricingConfig.walkingDistanceStepPrice;

  return {
    billableWalkingDistanceMeters: roundDistance(billableWalkingDistanceMeters),
    walkingDistanceMeters: roundDistance(normalizedWalkingDistance),
    walkingDistancePrice,
    walkingDistanceSteps,
  };
}

function calculateFurnitureVolumeCubicMeters(furnitureSelection: MoveCalculationFurnitureInput) {
  const lengthMeters = parseNumericInput(furnitureSelection.lengthCm) / 100;
  const widthMeters = parseNumericInput(furnitureSelection.widthCm) / 100;
  const heightMeters = parseNumericInput(furnitureSelection.heightCm) / 100;

  return roundVolume(lengthMeters * widthMeters * heightMeters);
}

function calculateFurnitureVolumePrice(totalVolumeCubicMeters: number, pricingConfig: MovePricingConfig = movePricingConfig) {
  if (totalVolumeCubicMeters <= 0) {
    return 0;
  }

  const fullCubicMeters = Math.floor(totalVolumeCubicMeters);
  const hasDecimalShare = totalVolumeCubicMeters - fullCubicMeters > 0.000001;

  return fullCubicMeters * pricingConfig.furnitureCubicMeterFullPrice +
    (hasDecimalShare ? pricingConfig.furnitureCubicMeterDecimalPrice : 0);
}

export function calculateMovePricing(
  routeKilometers: number,
  addresses: MoveCalculationAddressInput[],
  furnitureSelections: MoveCalculationFurnitureInput[],
  pricingConfig: MovePricingConfig = movePricingConfig,
): MoveCalculationPricing {
  const addressCharges = addresses.map((address) => {
    const walkingDistanceCharge = calculateWalkingDistanceCharge(address.walkingDistanceMeters, pricingConfig);
    const noParkingZonePrice = address.hasNoParkingZone ? pricingConfig.noParkingZoneFlatFee : 0;
    const accessCharge = calculateAccessCharge(address, pricingConfig);

    return {
      accessPrice: accessCharge.accessPrice,
      addressId: address.id,
      addressKind: address.kind,
      addressLabel: formatMoveAddressLabel(address),
      billableWalkingDistanceMeters: walkingDistanceCharge.billableWalkingDistanceMeters,
      elevatorPrice: accessCharge.elevatorPrice,
      floorLabel: accessCharge.floorLabel,
      floorLevel: accessCharge.floorLevel,
      floorPrice: accessCharge.floorPrice,
      hasElevator: Boolean(address.hasElevator),
      hasNoParkingZone: Boolean(address.hasNoParkingZone),
      noParkingZonePrice,
      walkingDistanceMeters: walkingDistanceCharge.walkingDistanceMeters,
      walkingDistancePrice: walkingDistanceCharge.walkingDistancePrice,
      walkingDistanceSteps: walkingDistanceCharge.walkingDistanceSteps,
    };
  });
  const furnitureCharges = furnitureSelections.map((furnitureSelection) => {
    const volumeCubicMeters = calculateFurnitureVolumeCubicMeters(furnitureSelection);

    return {
      assemblyPrice: furnitureSelection.isAssembly ? pricingConfig.assemblyPricePerItem : 0,
      dimensionsCentimeters: {
        height: parseNumericInput(furnitureSelection.heightCm),
        length: parseNumericInput(furnitureSelection.lengthCm),
        width: parseNumericInput(furnitureSelection.widthCm),
      },
      disassemblyPrice: furnitureSelection.isDisassembly ? pricingConfig.disassemblyPricePerItem : 0,
      disposalPrice: furnitureSelection.isDisposal
        ? roundCurrency(volumeCubicMeters * pricingConfig.disposalPricePerCubicMeter)
        : 0,
      furnitureId: furnitureSelection.id,
      furnitureName: furnitureSelection.furnitureName,
      isAssembly: Boolean(furnitureSelection.isAssembly),
      isDisassembly: Boolean(furnitureSelection.isDisassembly),
      isDisposal: Boolean(furnitureSelection.isDisposal),
      volumeCubicMeters,
    };
  });

  const distanceKilometers = roundDistance(routeKilometers);
  const distancePrice = roundCurrency(distanceKilometers * pricingConfig.pricePerKilometer);
  const accessPrice = addressCharges.reduce((sum, addressCharge) => sum + addressCharge.accessPrice, 0);
  const walkingDistancePrice = addressCharges.reduce((sum, addressCharge) => sum + addressCharge.walkingDistancePrice, 0);
  const noParkingZonePrice = addressCharges.reduce((sum, addressCharge) => sum + addressCharge.noParkingZonePrice, 0);
  const furnitureVolumeCubicMeters = roundVolume(
    furnitureCharges
      .filter((furnitureCharge) => !furnitureCharge.isDisposal)
      .reduce((sum, furnitureCharge) => sum + furnitureCharge.volumeCubicMeters, 0),
  );
  const furnitureVolumePrice = calculateFurnitureVolumePrice(furnitureVolumeCubicMeters, pricingConfig);
  const disposalVolumeCubicMeters = roundVolume(
    furnitureCharges
      .filter((furnitureCharge) => furnitureCharge.isDisposal)
      .reduce((sum, furnitureCharge) => sum + furnitureCharge.volumeCubicMeters, 0),
  );
  const disposalPrice = furnitureCharges.reduce((sum, furnitureCharge) => sum + furnitureCharge.disposalPrice, 0);
  const assemblyPrice = furnitureCharges.reduce((sum, furnitureCharge) => sum + furnitureCharge.assemblyPrice, 0);
  const disassemblyPrice = furnitureCharges.reduce((sum, furnitureCharge) => sum + furnitureCharge.disassemblyPrice, 0);

  return {
    accessPrice,
    addressCharges,
    assemblyPrice,
    disassemblyPrice,
    distanceKilometers,
    distancePrice,
    disposalPrice,
    disposalVolumeCubicMeters,
    elevatorFlatFee: pricingConfig.elevatorFlatFee,
    freeWalkingDistanceMeters: pricingConfig.freeWalkingDistanceMeters,
    floorPricePerLevel: pricingConfig.floorPricePerLevel,
    furnitureCharges,
    furnitureVolumeCubicMeters,
    furnitureVolumeDecimalPrice: pricingConfig.furnitureCubicMeterDecimalPrice,
    furnitureVolumePrice,
    furnitureVolumePricePerCubicMeter: pricingConfig.furnitureCubicMeterFullPrice,
    noParkingZoneFlatFee: pricingConfig.noParkingZoneFlatFee,
    noParkingZonePrice,
    pricePerKilometer: pricingConfig.pricePerKilometer,
    totalPrice: roundCurrency(
      distancePrice +
        walkingDistancePrice +
        noParkingZonePrice +
        accessPrice +
        furnitureVolumePrice +
        disposalPrice +
        assemblyPrice +
        disassemblyPrice,
    ),
    walkingDistancePrice,
    walkingDistanceStepMeters: pricingConfig.walkingDistanceStepMeters,
    walkingDistanceStepPrice: pricingConfig.walkingDistanceStepPrice,
  };
}

export function haversineDistanceKilometers(start: Coordinate, end: Coordinate) {
  const earthRadiusKilometers = 6371;
  const latitudeDelta = toRadians(end.latitude - start.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKilometers * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function buildStopDistanceMatrix(start: Coordinate, stops: Coordinate[], end: Coordinate) {
  return {
    distancesFromStart: stops.map((stop) => haversineDistanceKilometers(start, stop)),
    distancesToEnd: stops.map((stop) => haversineDistanceKilometers(stop, end)),
    stopMatrix: stops.map((fromStop) => stops.map((toStop) => haversineDistanceKilometers(fromStop, toStop))),
  };
}

function findExactStopOrder(start: Coordinate, stops: Coordinate[], end: Coordinate) {
  const stopCount = stops.length;

  if (stopCount === 0) {
    return [];
  }

  const { distancesFromStart, distancesToEnd, stopMatrix } = buildStopDistanceMatrix(start, stops, end);
  const allMasks = 1 << stopCount;
  const distances = Array.from({ length: allMasks }, () => Array<number>(stopCount).fill(Number.POSITIVE_INFINITY));
  const parents = Array.from({ length: allMasks }, () => Array<number>(stopCount).fill(-1));

  for (let stopIndex = 0; stopIndex < stopCount; stopIndex += 1) {
    distances[1 << stopIndex][stopIndex] = distancesFromStart[stopIndex];
  }

  for (let mask = 1; mask < allMasks; mask += 1) {
    for (let lastStopIndex = 0; lastStopIndex < stopCount; lastStopIndex += 1) {
      if ((mask & (1 << lastStopIndex)) === 0) {
        continue;
      }

      const previousMask = mask ^ (1 << lastStopIndex);

      if (previousMask === 0) {
        continue;
      }

      for (let previousStopIndex = 0; previousStopIndex < stopCount; previousStopIndex += 1) {
        if ((previousMask & (1 << previousStopIndex)) === 0) {
          continue;
        }

        const candidateDistance =
          distances[previousMask][previousStopIndex] + stopMatrix[previousStopIndex][lastStopIndex];

        if (candidateDistance < distances[mask][lastStopIndex]) {
          distances[mask][lastStopIndex] = candidateDistance;
          parents[mask][lastStopIndex] = previousStopIndex;
        }
      }
    }
  }

  const fullMask = allMasks - 1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestLastStopIndex = 0;

  for (let stopIndex = 0; stopIndex < stopCount; stopIndex += 1) {
    const candidateDistance = distances[fullMask][stopIndex] + distancesToEnd[stopIndex];

    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      bestLastStopIndex = stopIndex;
    }
  }

  const orderedStops: number[] = [];
  let currentMask = fullMask;
  let currentStopIndex = bestLastStopIndex;

  while (currentMask > 0) {
    orderedStops.push(currentStopIndex);
    const previousStopIndex = parents[currentMask][currentStopIndex];
    currentMask ^= 1 << currentStopIndex;
    currentStopIndex = previousStopIndex;
  }

  return orderedStops.reverse();
}

function findHeuristicStopOrder(start: Coordinate, stops: Coordinate[], end: Coordinate) {
  const remainingStopIndexes = new Set(stops.map((_, index) => index));
  const orderedStops: number[] = [];
  let currentCoordinate = start;

  while (remainingStopIndexes.size > 0) {
    let bestStopIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const stopIndex of remainingStopIndexes) {
      const currentDistance = haversineDistanceKilometers(currentCoordinate, stops[stopIndex]);
      const endBiasDistance = haversineDistanceKilometers(stops[stopIndex], end) * 0.15;
      const candidateDistance = currentDistance + endBiasDistance;

      if (candidateDistance < bestDistance) {
        bestDistance = candidateDistance;
        bestStopIndex = stopIndex;
      }
    }

    if (bestStopIndex === -1) {
      break;
    }

    orderedStops.push(bestStopIndex);
    currentCoordinate = stops[bestStopIndex];
    remainingStopIndexes.delete(bestStopIndex);
  }

  return improveStopOrderWithTwoOpt(orderedStops, start, stops, end);
}

function improveStopOrderWithTwoOpt(stopOrder: number[], start: Coordinate, stops: Coordinate[], end: Coordinate) {
  const improvedStopOrder = [...stopOrder];

  if (improvedStopOrder.length < 3) {
    return improvedStopOrder;
  }

  let hasImprovement = true;

  while (hasImprovement) {
    hasImprovement = false;

    for (let leftIndex = 0; leftIndex < improvedStopOrder.length - 1; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < improvedStopOrder.length; rightIndex += 1) {
        const currentPreviousCoordinate =
          leftIndex === 0 ? start : stops[improvedStopOrder[leftIndex - 1]];
        const currentStartCoordinate = stops[improvedStopOrder[leftIndex]];
        const currentEndCoordinate = stops[improvedStopOrder[rightIndex]];
        const currentNextCoordinate =
          rightIndex === improvedStopOrder.length - 1 ? end : stops[improvedStopOrder[rightIndex + 1]];

        const currentDistance =
          haversineDistanceKilometers(currentPreviousCoordinate, currentStartCoordinate) +
          haversineDistanceKilometers(currentEndCoordinate, currentNextCoordinate);
        const swappedDistance =
          haversineDistanceKilometers(currentPreviousCoordinate, currentEndCoordinate) +
          haversineDistanceKilometers(currentStartCoordinate, currentNextCoordinate);

        if (swappedDistance + 0.000001 < currentDistance) {
          const reversedSlice = improvedStopOrder.slice(leftIndex, rightIndex + 1).reverse();
          improvedStopOrder.splice(leftIndex, rightIndex - leftIndex + 1, ...reversedSlice);
          hasImprovement = true;
        }
      }
    }
  }

  return improvedStopOrder;
}

export function calculateOptimizedStopOrder(start: Coordinate, stops: Coordinate[], end: Coordinate) {
  if (stops.length <= 1) {
    return stops.map((_, index) => index);
  }

  return stops.length <= 8 ? findExactStopOrder(start, stops, end) : findHeuristicStopOrder(start, stops, end);
}
