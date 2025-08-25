-- CreateIndex
CREATE INDEX "assets_owner_id_idx" ON "public"."assets"("owner_id");

-- CreateIndex
CREATE INDEX "assets_status_created_at_idx" ON "public"."assets"("status", "created_at");

-- CreateIndex
CREATE INDEX "assets_object_key_idx" ON "public"."assets"("object_key");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "public"."audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "jobs_asset_id_idx" ON "public"."jobs"("asset_id");

-- CreateIndex
CREATE INDEX "jobs_state_idx" ON "public"."jobs"("state");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "public"."sessions"("user_id", "expires_at");
