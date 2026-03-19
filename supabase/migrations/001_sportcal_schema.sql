-- ═══════════════════════════════════════════════════════════════════
-- SportCal — Supabase Schema, RLS Policies & Seed Data
-- ═══════════════════════════════════════════════════════════════════

-- ── Organizations ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  access_code TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL,
  sport       TEXT,
  logo_url    TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Events ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT,
  date              DATE NOT NULL,
  time              TIME,
  location          TEXT,
  organization_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  organization_name TEXT NOT NULL DEFAULT '',
  image_url         TEXT,
  sport             TEXT,
  is_published      BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ── Audit Logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  actor_org   TEXT,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Updated_at trigger ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orgs_updated
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_events_updated
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ───────────────────────────────────────────

-- Organizations: public read, no public write
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read organizations"
  ON organizations FOR SELECT USING (is_active = true);

-- Events: public can read published events, anon can insert
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published events"
  ON events FOR SELECT USING (is_published = true);
CREATE POLICY "Anyone can insert events"
  ON events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own events"
  ON events FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete events"
  ON events FOR DELETE USING (true);

-- Audit logs: insert only
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert audit logs"
  ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read audit logs"
  ON audit_logs FOR SELECT USING (true);

-- ── Storage bucket for event images ─────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-images', 'event-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read event images"
  ON storage.objects FOR SELECT USING (bucket_id = 'event-images');
CREATE POLICY "Anyone can upload event images"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-images');
CREATE POLICY "Anyone can delete event images"
  ON storage.objects FOR DELETE USING (bucket_id = 'event-images');

-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO organizations (name, access_code, email, sport) VALUES
  ('Department of Sports & Recreation',    'safehands',     'sports@gov.bm',                        NULL),
  ('UMIN Design',                          'juren',         'design@umin.bm',                       NULL),
  ('Bermuda Football Association',         '1A2b3C4d5E6f7G','football@sportsandrec.gov.bm',         'Football (Soccer)'),
  ('Bermuda Cricket Board',                '1H2i3J4k5L6m7N','cricket@sportsandrec.gov.bm',          'Cricket'),
  ('Bermuda Rugby Football Union',         '1O2p3Q4r5S6t7U','rugby@sportsandrec.gov.bm',            'Rugby'),
  ('Bermuda Basketball Association',       '1V2w3X4y5Z6a7B','basketball@sportsandrec.gov.bm',       'Basketball'),
  ('Bermuda Netball Association',          '1c2D3e4F5g6H7i','netball@sportsandrec.gov.bm',          'Netball'),
  ('Bermuda Tennis Association',           '1J2k3L4m5N6o7P','tennis@sportsandrec.gov.bm',           'Tennis'),
  ('Bermuda Swimming Association',         '1Q2r3S4t5U6v7W','swimming@sportsandrec.gov.bm',         'Swimming'),
  ('Bermuda Athletics Association',        '1X2y3Z4a5B6c7D','athletics@sportsandrec.gov.bm',        'Athletics (Track & Field)'),
  ('Bermuda Cycling Federation',           '1e2F3g4H5i6J7k','cycling@sportsandrec.gov.bm',          'Cycling'),
  ('Bermuda Triathlon Association',        '1L2m3N4o5P6q7R','triathlon@sportsandrec.gov.bm',        'Triathlon'),
  ('Bermuda Squash Racquet Association',   '1S2t3U4v5W6x7Y','squash@sportsandrec.gov.bm',           'Squash'),
  ('Bermuda Bowling Federation',           '1Z2a3B4c5D6e7F','bowling@sportsandrec.gov.bm',          'Bowling'),
  ('Bermuda Golf Association',             '2G3h4I5j6K7l8M','golf@sportsandrec.gov.bm',             'Golf'),
  ('Bermuda Hockey Association',           '2N3o4P5q6R7s8T','hockey@sportsandrec.gov.bm',           'Hockey'),
  ('Bermuda Boxing Association',           '2U3v4W5x6Y7z8A','boxing@sportsandrec.gov.bm',           'Boxing'),
  ('Bermuda Karate Association',           '2b3C4d5E6f7G8h','karate@sportsandrec.gov.bm',           'Karate'),
  ('Bermuda Equestrian Federation',        '2I3j4K5l6M7n8O','equestrian@sportsandrec.gov.bm',       'Equestrian'),
  ('Bermuda Sailing Association',          '3Q4r5S6t7U8v9W','sailing@sportsandrec.gov.bm',          'Sailing'),
  ('Bermuda Volleyball Association',       '4L5m6N7o8P9q0R','volleyball@sportsandrec.gov.bm',       'Volleyball'),
  ('Boccia Bermuda',                       '4n5O6p7Q8R9s0T','boccia@sportsandrec.gov.bm',           'Boccia'),
  ('Gymnastics Federation of Bermuda',     '4v5W6x7Y8Z9a0B','gymnastics@sportsandrec.gov.bm',       'Gymnastics'),
  ('National Archery Association of Bermuda','5G6h7I8j9K0l1M','archery@sportsandrec.gov.bm',        'Archery'),
  ('Pickleball Association of Bermuda',    '5O6p7Q8r9S0t1U','pickleball@sportsandrec.gov.bm',       'Pickleball'),
  ('Bermuda Karting Association',          '6K7l8M9n0O1p2Q','karting@sportsandrec.gov.bm',          'Karting'),
  ('Bermuda Rowing Association',           '6R7s8T9u0V1w2X','rowing@sportsandrec.gov.bm',           'Rowing'),
  ('Bermuda Motocross Association',        '6Y7z8A9b0C1d2E','motocross@sportsandrec.gov.bm',        'Motocross'),
  ('Bermuda Olympic Association',          'Z3309MZS8K',    'olympic@sportsandrec.gov.bm',          'Olympics')
ON CONFLICT (name) DO NOTHING;

-- Sample Events (linked to orgs by name lookup)
INSERT INTO events (title, description, date, time, location, organization_id, organization_name, sport, is_published)
SELECT
  'Football - Premier Division Opening Day',
  'The opening day of the 2026 Premier Division season. All clubs competing in a round-robin format.',
  '2026-04-05', '14:00', 'National Sports Centre, Devonshire',
  o.id, o.name, 'Football (Soccer)', true
FROM organizations o WHERE o.name = 'Bermuda Football Association'
ON CONFLICT DO NOTHING;

INSERT INTO events (title, description, date, time, location, organization_id, organization_name, sport, is_published)
SELECT
  'Cricket - Cup Match Classic',
  'The annual Cup Match cricket classic between Somerset and St. George''s. A beloved Bermuda tradition.',
  '2026-07-30', '10:00', 'Somerset Cricket Club',
  o.id, o.name, 'Cricket', true
FROM organizations o WHERE o.name = 'Bermuda Cricket Board'
ON CONFLICT DO NOTHING;

INSERT INTO events (title, description, date, time, location, organization_id, organization_name, sport, is_published)
SELECT
  'Triathlon - Bermuda World Triathlon',
  'Elite and age-group triathletes compete in the annual Bermuda World Triathlon event.',
  '2026-05-16', '07:00', 'Hamilton, Bermuda',
  o.id, o.name, 'Triathlon', true
FROM organizations o WHERE o.name = 'Bermuda Triathlon Association'
ON CONFLICT DO NOTHING;

INSERT INTO events (title, description, date, time, location, organization_id, organization_name, sport, is_published)
SELECT
  'Swimming - National Championships',
  'Annual national swimming championships across all age groups and distances.',
  '2026-06-20', '09:00', 'National Aquatics Centre',
  o.id, o.name, 'Swimming', true
FROM organizations o WHERE o.name = 'Bermuda Swimming Association'
ON CONFLICT DO NOTHING;

INSERT INTO events (title, description, date, time, location, organization_id, organization_name, sport, is_published)
SELECT
  'Rugby - Ariel Re 7s Tournament',
  'The prestigious Ariel Re Rugby 7s Tournament featuring international and local teams.',
  '2026-04-25', '09:00', 'National Sports Centre',
  o.id, o.name, 'Rugby', true
FROM organizations o WHERE o.name = 'Bermuda Rugby Football Union'
ON CONFLICT DO NOTHING;

INSERT INTO events (title, description, date, time, location, organization_id, organization_name, sport, is_published)
SELECT
  'Sailing - Newport to Bermuda Race',
  'The biennial Newport Bermuda Race — one of the oldest ocean races in the world.',
  '2026-06-19', '12:00', 'Hamilton Harbour',
  o.id, o.name, 'Sailing', true
FROM organizations o WHERE o.name = 'Bermuda Sailing Association'
ON CONFLICT DO NOTHING;

INSERT INTO events (title, description, date, time, location, organization_id, organization_name, sport, is_published)
SELECT
  'Athletics - Track & Field Championships',
  'National Track & Field Championships featuring sprints, jumps, throws and distance events.',
  '2026-05-30', '09:00', 'National Sports Centre Track',
  o.id, o.name, 'Athletics (Track & Field)', true
FROM organizations o WHERE o.name = 'Bermuda Athletics Association'
ON CONFLICT DO NOTHING;

INSERT INTO events (title, description, date, time, location, organization_id, organization_name, sport, is_published)
SELECT
  'Tennis - ITF Junior Circuit',
  'International Tennis Federation Junior Circuit event hosted in Bermuda.',
  '2026-04-12', '08:00', 'Coral Beach & Tennis Club',
  o.id, o.name, 'Tennis', true
FROM organizations o WHERE o.name = 'Bermuda Tennis Association'
ON CONFLICT DO NOTHING;
