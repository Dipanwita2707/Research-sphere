-- Add Conference School Assignment Field to Central Department Permissions
ALTER TABLE "central_department_permission" ADD COLUMN IF NOT EXISTS "assigned_conference_school_ids" JSONB DEFAULT '[]';
