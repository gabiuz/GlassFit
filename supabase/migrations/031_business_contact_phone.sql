-- fix-21 / PRD-F13 / SDD-C8: update the business singleton phone.
-- Rollback on disposable data: restore the old default and update only rows
-- still holding the new number. Never roll back a later Owner edit.
ALTER TABLE public.system_preferences
    ALTER COLUMN contact_phone SET DEFAULT '+63 905 325 8970';

UPDATE public.system_preferences
SET contact_phone = '+63 905 325 8970'
WHERE singleton_key = 'GLOBAL_PREFERENCES'
  AND contact_phone = '+63 917 123 4567';
