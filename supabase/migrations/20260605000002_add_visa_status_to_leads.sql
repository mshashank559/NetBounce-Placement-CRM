-- Migration: Add visa_status column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS visa_status TEXT;
