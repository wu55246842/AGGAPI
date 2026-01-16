-- AlterTable
ALTER TABLE "UsageEvent" ADD COLUMN     "modelVariantId" TEXT,
ADD COLUMN     "metricJson" JSONB;

-- CreateTable
CREATE TABLE "public_models" (
    "id" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "capabilitiesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_variants" (
    "id" TEXT NOT NULL,
    "publicModelId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerModel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priceJson" JSONB NOT NULL,
    "regionsJson" JSONB NOT NULL,
    "routingJson" JSONB NOT NULL,
    "capabilitiesOverride" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "public_models_publicName_key" ON "public_models"("publicName");

-- CreateIndex
CREATE UNIQUE INDEX "model_variants_publicModelId_provider_providerModel_key" ON "model_variants"("publicModelId", "provider", "providerModel");

-- AddForeignKey
ALTER TABLE "model_variants" ADD CONSTRAINT "model_variants_publicModelId_fkey" FOREIGN KEY ("publicModelId") REFERENCES "public_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
