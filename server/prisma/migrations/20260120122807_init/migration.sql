-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "iiif_manifest" TEXT NOT NULL,
    "document_name" VARCHAR(255),
    "annotations" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creator_device_id" UUID,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_by" VARCHAR(100),
    "annotations" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version_number" INTEGER NOT NULL,

    CONSTRAINT "versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_last_active_at_idx" ON "sessions"("last_active_at");

-- CreateIndex
CREATE INDEX "sessions_creator_device_id_idx" ON "sessions"("creator_device_id");

-- CreateIndex
CREATE INDEX "versions_session_id_version_number_idx" ON "versions"("session_id", "version_number" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "versions_session_id_version_number_key" ON "versions"("session_id", "version_number");

-- AddForeignKey
ALTER TABLE "versions" ADD CONSTRAINT "versions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
