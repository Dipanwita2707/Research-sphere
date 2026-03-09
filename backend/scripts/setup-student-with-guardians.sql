-- First, create StudentDetails record for STU001
-- Get the userLoginId first
DO $$
DECLARE
  v_user_id uuid;
  v_student_id uuid;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id FROM user_login WHERE uid = 'STU001';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Student STU001 not found';
  END IF;
  
  -- Check if StudentDetails already exists
  SELECT id INTO v_student_id FROM student_details WHERE user_login_id = v_user_id;
  
  IF v_student_id IS NULL THEN
    -- Create StudentDetails
    INSERT INTO student_details (
      id,
      user_login_id,
      first_name,
      last_name,
      roll_number,
      email,
      phone,
      batch,
      department,
      section,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      'Test',
      'Student',
      'STU001',
      'student@sgt.edu',
      '9999999999',
      '2024',
      'Computer Science',
      'A',
      NOW(),
      NOW()
    ) RETURNING id INTO v_student_id;
    
    RAISE NOTICE 'Created StudentDetails with ID: %', v_student_id;
    
    -- Now add a test guardian
    INSERT INTO parent_details (
      id,
      student_id,
      relationship,
      first_name,
      last_name,
      phone,
      email,
      is_primary_contact,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_student_id,
      'Father',
      'Rajesh',
      'Kumar',
      '9876543210',
      'rajesh.kumar@gmail.com',
      true,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created test guardian (Father)';
    
    -- Add a second guardian (Mother)
    INSERT INTO parent_details (
      id,
      student_id,
      relationship,
      first_name,
      last_name,
      phone,
      email,
      is_primary_contact,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_student_id,
      'Mother',
      'Sunita',
      'Kumar',
      '9876543211',
      'sunita.kumar@gmail.com',
      false,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created test guardian (Mother)';
    
  ELSE
    RAISE NOTICE 'StudentDetails already exists with ID: %', v_student_id;
  END IF;
  
END $$;

-- Verify the setup
SELECT 
  ul.uid,
  ul.role,
  sd.id as student_id,
  sd.first_name,
  sd.roll_number,
  COUNT(pd.id) as guardian_count
FROM user_login ul
LEFT JOIN student_details sd ON sd.user_login_id = ul.id
LEFT JOIN parent_details pd ON pd.student_id = sd.id
WHERE ul.uid = 'STU001'
GROUP BY ul.uid, ul.role, sd.id, sd.first_name, sd.roll_number;
