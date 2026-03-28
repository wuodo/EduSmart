-- CRM: tenant CRM JSON, inquiry messaging consent, tasks linked to inquiries
-- Safe to run on databases that already applied these via `db push` (IF NOT EXISTS).

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "crmSettings" JSONB;

ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "consentSms" BOOLEAN;
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "consentEmail" BOOLEAN;
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "consentWhatsapp" BOOLEAN;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "inquiryId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_inquiryId_fkey'
  ) THEN
    ALTER TABLE "tasks"
      ADD CONSTRAINT "tasks_inquiryId_fkey"
      FOREIGN KEY ("inquiryId") REFERENCES "inquiries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tasks_inquiryId_idx" ON "tasks"("inquiryId");
