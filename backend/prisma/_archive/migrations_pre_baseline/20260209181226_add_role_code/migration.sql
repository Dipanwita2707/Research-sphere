/*
  Warnings:

  - A unique constraint covering the columns `[role_code]` on the table `role` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `role_code` to the `role` table without a default value. This is not possible if the table is not empty.

*/
-- Step 1: Add column as nullable first
ALTER TABLE "role" ADD COLUMN "role_code" VARCHAR(32);

-- Step 2: Generate role codes for existing roles based on their names
UPDATE "role" SET "role_code" = UPPER(REPLACE(REPLACE(name, ' ', '_'), '-', '_')) WHERE "role_code" IS NULL;

-- Step 3: Handle any duplicates by appending a number
DO $$
DECLARE
    r RECORD;
    new_code VARCHAR(32);
    counter INT;
BEGIN
    FOR r IN 
        SELECT id, role_code 
        FROM role 
        WHERE role_code IN (
            SELECT role_code 
            FROM role 
            WHERE role_code IS NOT NULL
            GROUP BY role_code 
            HAVING COUNT(*) > 1
        )
        ORDER BY created_at
    LOOP
        counter := 1;
        new_code := r.role_code || '_' || counter;
        WHILE EXISTS (SELECT 1 FROM role WHERE role_code = new_code) LOOP
            counter := counter + 1;
            new_code := r.role_code || '_' || counter;
        END LOOP;
        UPDATE role SET role_code = new_code WHERE id = r.id;
    END LOOP;
END $$;

-- Step 4: Make the column NOT NULL
ALTER TABLE "role" ALTER COLUMN "role_code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "role_role_code_key" ON "role"("role_code");
