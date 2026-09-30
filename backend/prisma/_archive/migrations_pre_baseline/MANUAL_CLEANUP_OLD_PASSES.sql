-- Manual cleanup script for Gate Entry module
-- Run this in your database client (pgAdmin, DBeaver, etc.) OR via Prisma Studio

-- Step 1: Delete all gate pass notifications
DELETE FROM "gate_pass_notifications";

-- Step 2: Delete all gate pass history  
DELETE FROM "gate_pass_history";

-- Step 3: Delete all gate passes
DELETE FROM "gate_passes";

-- Step 4: Verify deletion
SELECT COUNT(*) as remaining_passes FROM "gate_passes";
SELECT COUNT(*) as remaining_history FROM "gate_pass_history";  
SELECT COUNT(*) as remaining_notifications FROM "gate_pass_notifications";

-- Output should show 0 for all three tables
