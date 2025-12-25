-- Skill-Based Starting Ratings Migration
-- Updates player creation to set initial rating based on skill level
-- Run this in Supabase SQL Editor

-- ============================================
-- UPDATE PLAYER CREATION TRIGGER
-- ============================================

-- Create or replace the function that handles new user creation
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
  INSERT INTO public.players (id, user_id, name, email, rating, highest_rating)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Player'),
    NEW.email,
    initial_rating,
    initial_rating
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger if it doesn't exist
-- First drop if exists to ensure we have the latest version
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- VERIFY SETUP
-- ============================================

-- Check that the trigger is set up correctly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE 'SUCCESS: Trigger on_auth_user_created is active';
  ELSE
    RAISE NOTICE 'WARNING: Trigger may not have been created';
  END IF;
END $$;
