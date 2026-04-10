-- CreateTable
CREATE TABLE "appointment_status_changes" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "previous_status" "AppointmentStatus",
    "new_status" "AppointmentStatus" NOT NULL,
    "changed_by_keycloak_id" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_status_changes_appointment_id_idx" ON "appointment_status_changes"("appointment_id");

-- AddForeignKey
ALTER TABLE "appointment_status_changes" ADD CONSTRAINT "appointment_status_changes_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
