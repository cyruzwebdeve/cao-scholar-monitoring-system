-- Immutable question versions; no existing examination, attendance or result is rewritten.
CREATE TABLE "online_exam_configurations" (
    "id" SERIAL NOT NULL,
    "previous_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "instructions" TEXT NOT NULL,
    "passing_score" INTEGER NOT NULL CHECK ("passing_score" BETWEEN 1 AND 20),
    "questions" JSONB NOT NULL,
    "created_by" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "online_exam_configurations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "online_exam_configurations_previous_id_key" ON "online_exam_configurations"("previous_id");
-- Zero identifies the built-in bank; NULL preserves paper/older result provenance.
ALTER TABLE "results" ADD COLUMN "online_configuration_id" INTEGER;
