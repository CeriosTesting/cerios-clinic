-- Add previous_scheduled_at and new_scheduled_at columns to support reschedule audit trail
ALTER TABLE "appointment_status_changes"
  ADD COLUMN "previous_scheduled_at" TIMESTAMP(3),
  ADD COLUMN "new_scheduled_at" TIMESTAMP(3);
