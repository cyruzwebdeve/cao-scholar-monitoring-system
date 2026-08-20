-- Add secure, single-use password reset support for applicant and administrator accounts.
ALTER TABLE "admins"
ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "control_accounts"
ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "password_reset_tokens" (
    "id" BIGSERIAL NOT NULL,
    "account_type" VARCHAR(20) NOT NULL,
    "account_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used_at" TIMESTAMP(6),
    "requested_ip" VARCHAR(45),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key"
ON "password_reset_tokens"("token_hash");

CREATE INDEX "password_reset_tokens_account_type_account_id_created_at_idx"
ON "password_reset_tokens"("account_type", "account_id", "created_at");

CREATE INDEX "password_reset_tokens_expires_at_idx"
ON "password_reset_tokens"("expires_at");
