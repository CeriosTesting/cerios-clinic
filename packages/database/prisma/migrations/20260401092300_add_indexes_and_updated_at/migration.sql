/*
  Warnings:

  - Added the required column `updated_at` to the `assistants` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `doctors` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: add with DEFAULT so existing rows get now(), then drop the default
ALTER TABLE "assistants" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "assistants" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "doctors" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "patients" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "appointments_patient_id_idx" ON "appointments"("patient_id");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_idx" ON "appointments"("doctor_id");

-- CreateIndex
CREATE INDEX "appointments_scheduled_at_idx" ON "appointments"("scheduled_at");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_scheduled_at_idx" ON "appointments"("doctor_id", "scheduled_at");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
