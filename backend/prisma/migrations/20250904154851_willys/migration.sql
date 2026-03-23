-- CreateTable
CREATE TABLE "cpanel_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpanel_config_pkey" PRIMARY KEY ("id")
);
