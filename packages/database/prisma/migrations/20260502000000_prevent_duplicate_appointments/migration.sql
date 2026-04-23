-- Prevent duplicate active appointments for the same doctor or patient at the same time.
-- Completed and cancelled appointments are excluded so freed slots can be reused.

CREATE UNIQUE INDEX "appointments_doctor_slot_active_unique"
  ON "appointments" ("doctor_id", "scheduled_at")
  WHERE "status" IN ('SCHEDULED', 'CONFIRMED');

CREATE UNIQUE INDEX "appointments_patient_slot_active_unique"
  ON "appointments" ("patient_id", "scheduled_at")
  WHERE "status" IN ('SCHEDULED', 'CONFIRMED');
