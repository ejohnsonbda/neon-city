#!/usr/bin/env python3
"""
Archive all 2025 events in SportCal Supabase database.

Strategy:
- Add an `archived` boolean column to the events table (default false)
- Set archived = true for all events where date is in 2025
- Update RLS policy so public reads exclude archived events
- The existing is_published column stays unchanged

We use the Supabase Management API (service role key) to run raw SQL,
and the REST API to perform the update.
"""

import requests
import json
import os

SUPABASE_URL = "https://kufokhkvgqgomicnsmpz.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1Zm9raGt2Z3Fnb21pY25zbXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MzUzODUsImV4cCI6MjA2NjMxMTM4NX0.hN86JSRhxPqSYolXJN5gn1cQ-Ibu21l1cHpLIaRY-hY"

headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Step 1: Count 2025 events before archiving
print("Step 1: Counting 2025 events...")
resp = requests.get(
    f"{SUPABASE_URL}/rest/v1/events",
    headers={**headers, "Prefer": "count=exact"},
    params={
        "date": "gte.2025-01-01",
        "date": "lte.2025-12-31",
        "select": "id,title,date,is_published"
    }
)

# Use range query properly
resp = requests.get(
    f"{SUPABASE_URL}/rest/v1/events?date=gte.2025-01-01&date=lte.2025-12-31&select=id,title,date,is_published",
    headers={**headers, "Prefer": "count=exact"}
)
print(f"  Status: {resp.status_code}")
print(f"  Content-Range: {resp.headers.get('content-range', 'N/A')}")
events_2025 = resp.json()
print(f"  Events found: {len(events_2025)}")
if events_2025:
    print(f"  First event: {events_2025[0].get('title')} on {events_2025[0].get('date')}")
    print(f"  Last event: {events_2025[-1].get('title')} on {events_2025[-1].get('date')}")

# Step 2: Check if archived column exists by trying to select it
print("\nStep 2: Checking if 'archived' column exists...")
resp_check = requests.get(
    f"{SUPABASE_URL}/rest/v1/events?select=id,archived&limit=1",
    headers=headers
)
print(f"  Status: {resp_check.status_code}")
has_archived_col = resp_check.status_code == 200
if has_archived_col:
    print("  'archived' column EXISTS")
else:
    print(f"  'archived' column does NOT exist: {resp_check.text[:200]}")

print("\nDone with checks. See archive_2025_exec.py for the actual archive operation.")
