-- SQL script to setup student user for Gate Entry testing
-- Run this directly in your database

-- First, verify student exists
SELECT id, uid, email, role 
FROM user_login 
WHERE uid = 'STU001';

-- If student doesn't exist, you can create it with this:
-- (Skip if already exists)
/*
INSERT INTO user_login (id, uid, email, password_hash, role, status, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'STU001',
  'student@sgt.edu',
  '$2a$10$YourHashedPasswordHere',  -- Hash for 'Test@123'
  'student',
  'active',
  NOW(),
  NOW()
);

INSERT INTO employee_details (id, user_login_id, display_name, employee_id, created_at, updated_at)
SELECT uuid_generate_v4(), id, 'Rahul Kumar (Student)', 'STU001', NOW(), NOW()
FROM user_login WHERE uid = 'STU001';
*/

-- Get Gate Entry department ID (or create if doesn't exist)
DO $$
DECLARE
  dept_id uuid;
  student_id uuid;
BEGIN
  -- Get or create Gate Entry department
  SELECT id INTO dept_id 
  FROM central_department 
  WHERE department_name = 'Gate Entry' OR department_code = 'GATE-ENTRY'
  LIMIT 1;
  
  IF dept_id IS NULL THEN
    INSERT INTO central_department (id, department_code, department_name, description, is_active, metadata, created_at, updated_at)
    VALUES (
      uuid_generate_v4(),
      'GATE-ENTRY',
      'Gate Entry',
      'Gate Entry Pass Management',
      true,
      '{}',
      NOW(),
      NOW()
    )
    RETURNING id INTO dept_id;
    
    RAISE NOTICE 'Created Gate Entry department: %', dept_id;
  END IF;
  
  -- Get student ID
  SELECT id INTO student_id FROM user_login WHERE uid = 'STU001';
  
  IF student_id IS NULL THEN
    RAISE EXCEPTION 'Student STU001 not found!';
  END IF;
  
  -- Check if permission already exists
  IF NOT EXISTS (
    SELECT 1 FROM central_department_permission 
    WHERE user_id = student_id AND central_dept_id = dept_id
  ) THEN
    -- Assign CREATE_PASS permission to student
    INSERT INTO central_department_permission (id, user_id, central_dept_id, permissions, created_at, updated_at)
    VALUES (
      uuid_generate_v4(),
      student_id,
      dept_id,
      '["CREATE_PASS"]'::jsonb,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Assigned CREATE_PASS permission to student %', student_id;
  ELSE
    RAISE NOTICE 'Permission already exists';
  END IF;
END $$;

-- Verify the setup
SELECT 
  ul.uid,
  ul.email,
  ul.role,
  ed.display_name,
  cd.department_name,
  cdp.permissions
FROM user_login ul
LEFT JOIN employee_details ed ON ed.user_login_id = ul.id
LEFT JOIN central_department_permission cdp ON cdp.user_id = ul.id
LEFT JOIN central_department cd ON cd.id = cdp.central_dept_id
WHERE ul.uid = 'STU001';
