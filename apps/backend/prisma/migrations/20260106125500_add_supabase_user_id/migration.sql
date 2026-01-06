-- AlterTable
ALTER TABLE "users" ADD COLUMN "supabase_user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_user_id_key" ON "users"("supabase_user_id");

-- CreateIndex
CREATE INDEX "users_supabase_user_id_idx" ON "users"("supabase_user_id");

