-- Preserve existing results as unpublished; provenance is unknown for older rows.
ALTER TABLE "results"
  ADD COLUMN "delivery_mode" VARCHAR(10),
  ADD COLUMN "published_at" TIMESTAMP(6),
  ADD COLUMN "published_by" INTEGER,
  ADD COLUMN "review_history" JSONB NOT NULL DEFAULT '[]';
-- Versioned online results have unambiguous provenance (including version zero).
UPDATE "results" SET "delivery_mode" = 'online' WHERE "online_configuration_id" IS NOT NULL;
ALTER TABLE "results" ADD CONSTRAINT "results_delivery_mode_check"
  CHECK ("delivery_mode" IS NULL OR "delivery_mode" IN ('paper', 'online'));
ALTER TABLE "results" ADD CONSTRAINT "results_publication_pair_check"
  CHECK (("published_at" IS NULL) = ("published_by" IS NULL));
