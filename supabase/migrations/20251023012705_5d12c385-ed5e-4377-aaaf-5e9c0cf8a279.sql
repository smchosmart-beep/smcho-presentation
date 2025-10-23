-- Remove existing CHECK constraint that limits group_number to 10
ALTER TABLE tour_groups 
DROP CONSTRAINT IF EXISTS tour_groups_group_number_check;

-- Add new CHECK constraint allowing group_number from 1 to 50
ALTER TABLE tour_groups 
ADD CONSTRAINT tour_groups_group_number_check 
CHECK (group_number >= 1 AND group_number <= 50);