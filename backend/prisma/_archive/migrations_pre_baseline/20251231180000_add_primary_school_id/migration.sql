-- Add primary_school_id column to employee_details table
ALTER TABLE "employee_details" ADD COLUMN IF NOT EXISTS "primary_school_id" UUID;

-- Add foreign key constraint
ALTER TABLE "employee_details" ADD CONSTRAINT "employee_details_primary_school_id_fkey" FOREIGN KEY ("primary_school_id") REFERENCES "faculty_school_list"("id") ON DELETE SET NULL ON UPDATE CASCADE;
