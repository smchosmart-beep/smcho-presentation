-- Remove existing UNIQUE constraint on (session_id, row_label)
ALTER TABLE seat_layout 
DROP CONSTRAINT IF EXISTS seat_layout_session_row_label_unique;

-- Create new PARTIAL UNIQUE INDEX that only applies to active rows
-- This allows reusing row_labels for inactive (soft-deleted) rows
CREATE UNIQUE INDEX seat_layout_session_row_label_active_unique 
ON seat_layout (session_id, row_label) 
WHERE is_active = true;