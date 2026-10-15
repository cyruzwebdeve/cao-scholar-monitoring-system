CREATE TABLE "passer_lists" (
 "id" SERIAL PRIMARY KEY, "request_key" UUID NOT NULL UNIQUE,
 "academic_period_id" INTEGER NOT NULL REFERENCES "academic_periods"("id") ON DELETE RESTRICT,
 "title" VARCHAR(160) NOT NULL, "status" VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
 "created_by" INTEGER NOT NULL REFERENCES "admins"("id") ON DELETE RESTRICT,
 "posted_by" INTEGER REFERENCES "admins"("id") ON DELETE RESTRICT,
 "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "posted_at" TIMESTAMP(6),
 "supersedes_id" INTEGER REFERENCES "passer_lists"("id") ON DELETE RESTRICT, "revision_reason" TEXT,
 CHECK ((status = 'posted') = (posted_at IS NOT NULL)),
 CHECK (supersedes_id IS NULL OR (revision_reason IS NOT NULL AND length(trim(revision_reason)) > 0))
);
CREATE INDEX "passer_lists_academic_period_id_status_idx" ON "passer_lists"("academic_period_id","status");
CREATE UNIQUE INDEX "passer_lists_one_posted_revision" ON "passer_lists"("supersedes_id") WHERE status = 'posted';
CREATE TABLE "passer_list_members" (
 "id" SERIAL PRIMARY KEY, "list_id" INTEGER NOT NULL REFERENCES "passer_lists"("id") ON DELETE RESTRICT,
 "academic_period_id" INTEGER NOT NULL REFERENCES "academic_periods"("id") ON DELETE RESTRICT,
 "applicant_id" INTEGER NOT NULL REFERENCES "applicants"("id") ON DELETE RESTRICT,
 "application_id" INTEGER NOT NULL REFERENCES "application_submissions"("id") ON DELETE RESTRICT,
 "result_id" INTEGER NOT NULL REFERENCES "results"("id") ON DELETE RESTRICT,
 "exam_id" INTEGER NOT NULL REFERENCES "exams"("id") ON DELETE RESTRICT,
 "snapshot" JSONB NOT NULL,
 UNIQUE("list_id","applicant_id")
);
CREATE INDEX "passer_list_members_applicant_id_academic_period_id_idx" ON "passer_list_members"("applicant_id","academic_period_id");
CREATE FUNCTION protect_posted_passer_list() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE header_status TEXT; header_period INTEGER;
BEGIN
 IF TG_TABLE_NAME = 'passer_lists' THEN
  IF OLD.status = 'posted' THEN RAISE EXCEPTION 'Posted passer lists are immutable; create a revision'; END IF;
 ELSE
  IF TG_OP = 'UPDATE' AND OLD.list_id <> NEW.list_id THEN RAISE EXCEPTION 'Members cannot move between retained lists'; END IF;
  SELECT status, academic_period_id INTO header_status, header_period FROM passer_lists WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.list_id ELSE NEW.list_id END FOR UPDATE;
  IF header_status = 'posted' THEN RAISE EXCEPTION 'Posted passer list members are immutable'; END IF;
  IF TG_OP <> 'DELETE' AND header_period <> NEW.academic_period_id THEN RAISE EXCEPTION 'Member period must match its list'; END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_posted_passer_lists BEFORE UPDATE OR DELETE ON passer_lists FOR EACH ROW EXECUTE FUNCTION protect_posted_passer_list();
CREATE TRIGGER immutable_posted_passer_members BEFORE INSERT OR UPDATE OR DELETE ON passer_list_members FOR EACH ROW EXECUTE FUNCTION protect_posted_passer_list();
