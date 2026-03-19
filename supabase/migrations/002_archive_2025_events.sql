-- Migration 002: Archive 2025 Events
-- Date: 2026-03-19
-- Description: Adds 'archived' boolean column to events table and archives all 2025 events.
--              Updates RLS policy to exclude archived events from public reads.

-- Step 1: Add archived column
ALTER TABLE events ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Step 2: Archive all events with dates in 2025
UPDATE events
SET archived = true
WHERE date >= '2025-01-01' AND date <= '2025-12-31';

-- Step 3: Update RLS policy to exclude archived events from public reads
DROP POLICY IF EXISTS "Public read published events" ON events;

CREATE POLICY "Public read published events"
  ON events FOR SELECT
  USING (is_published = true AND (archived = false OR archived IS NULL));
