CREATE TABLE IF NOT EXISTS "FurnitureItem" (
  "id" TEXT NOT NULL,
  "furnitureName" TEXT NOT NULL,
  "lengthCm" DOUBLE PRECISION NOT NULL,
  "widthCm" DOUBLE PRECISION NOT NULL,
  "heightCm" DOUBLE PRECISION NOT NULL,
  "standardRooms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "rooms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "FurnitureItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FurnitureItem_furnitureName_idx" ON "FurnitureItem"("furnitureName");
