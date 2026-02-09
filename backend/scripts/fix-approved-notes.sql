-- Fix notes that were approved but stuck in pending status
-- This happens when approval incorrectly forwarded to next step (old bug)

-- First, let's see which notes need fixing
SELECT 
    n.id,
    n.noting_id,
    n.status,
    n.current_holder_id,
    n.current_flow_index,
    (
        SELECT nh.action 
        FROM note_history nh 
        WHERE nh.note_id = n.id 
        ORDER BY nh.created_at DESC 
        LIMIT 1
    ) as last_action
FROM note n
WHERE n.status = 'pending'
AND EXISTS (
    SELECT 1 
    FROM note_history nh 
    WHERE nh.note_id = n.id 
    AND nh.action = 'APPROVED'
    AND nh.created_at = (
        SELECT MAX(nh2.created_at) 
        FROM note_history nh2 
        WHERE nh2.note_id = n.id
    )
);

-- Now fix them
UPDATE note n
SET 
    status = 'approved',
    current_holder_id = NULL,
    current_flow_index = NULL,
    updated_at = NOW()
WHERE n.status = 'pending'
AND EXISTS (
    SELECT 1 
    FROM note_history nh 
    WHERE nh.note_id = n.id 
    AND nh.action = 'APPROVED'
    AND nh.created_at = (
        SELECT MAX(nh2.created_at) 
        FROM note_history nh2 
        WHERE nh2.note_id = n.id
    )
);
