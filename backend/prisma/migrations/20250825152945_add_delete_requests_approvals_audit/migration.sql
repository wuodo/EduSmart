-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "user" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delete_requests" (
    "id" SERIAL NOT NULL,
    "module" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "reason" TEXT,
    "requestedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delete_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delete_approvals" (
    "id" SERIAL NOT NULL,
    "officerEmail" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemName" TEXT,
    "reason" TEXT,
    "approvedBy" TEXT,
    "readBy" JSONB,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delete_approvals_pkey" PRIMARY KEY ("id")
);
