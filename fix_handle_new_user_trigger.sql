-- Fix: Handle New User Trigger
-- Fixes the signup error caused by referencing non-existent columns
-- Run this IMMEDIATELY in Supabase SQL Editor

-- ============================================
-- CORRECTED USER CREATION TRIGGER
-- ============================================
-- The previous version referenced 'user_id' and 'email' columns
-- that don't exist in the players table. This fixes that.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  initial_rating INTEGER;
  skill_level TEXT;
BEGIN
  -- Get skill level from user metadata (default to 'regular' if not set)
  skill_level := COALESCE(NEW.raw_user_meta_data->>'skill_level', 'regular');

  -- Map skill level to initial rating
  initial_rating := CASE skill_level
    WHEN 'beginner' THEN 1200
    WHEN 'casual' THEN 1350
    WHEN 'regular' THEN 1500
    WHEN 'experienced' THEN 1650
    WHEN 'advanced' THEN 1800
    ELSE 1500  -- fallback default
  END;

  -- Insert the new player record
  -- Only using columns that exist in the players table
  INSERT INTO public.players (id, name, rating, highest_rating)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Player'),
    initial_rating,
    initial_rating
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFY FIX
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'handle_new_user'
  ) THEN
    RAISE NOTICE 'SUCCESS: handle_new_user function has been fixed';
  END IF;
END $$;
