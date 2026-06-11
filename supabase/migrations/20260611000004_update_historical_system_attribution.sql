-- Migration to update historical "by System." notifications to "by Nilay Suthar."
UPDATE public.notifications
SET message = regexp_replace(message, ' by System\.$', ' by Nilay Suthar.')
WHERE message LIKE '% by System.';
