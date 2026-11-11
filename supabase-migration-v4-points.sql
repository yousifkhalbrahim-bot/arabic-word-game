-- ========================================
-- ترقية v4: النقاط والترتيب
-- شغّله مرة وحدة في SQL Editor (آمن لإعادة التشغيل)
--
-- كل جهاز له معرّف عشوائي (بدون حسابات). النقاط تنضاف فقط عن طريق
-- دالة add_points (حد أعلى لكل مرة + فاصل زمني)، والجدول مقفول تماماً
-- (RLS بدون سياسات) فما أحد يقدر يعدّل نقاطه مباشرة.
-- ========================================

CREATE TABLE IF NOT EXISTS players (
  id          uuid PRIMARY KEY,
  name        text NOT NULL DEFAULT 'لاعب',
  points      int  NOT NULL DEFAULT 0,
  week_points int  NOT NULL DEFAULT 0,
  week_key    text NOT NULL DEFAULT '',
  wins        int  NOT NULL DEFAULT 0,
  last_at     timestamptz NOT NULL DEFAULT (now() - interval '1 hour'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;  -- بدون سياسات = ما أحد يقرأ/يكتب مباشرة

CREATE INDEX IF NOT EXISTS players_points_idx ON players (points DESC);
CREATE INDEX IF NOT EXISTS players_week_idx   ON players (week_key, week_points DESC);

-- الأسبوع حسب توقيت السعودية (يبدأ الإثنين)
CREATE OR REPLACE FUNCTION _week_key() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT to_char(now() AT TIME ZONE 'Asia/Riyadh', 'IYYY-IW')
$$;

CREATE OR REPLACE FUNCTION _clean_name(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN left(btrim(coalesce(p_name, '')), 20) = '' THEN 'لاعب'
              ELSE left(btrim(p_name), 20) END
$$;

-- إضافة نقاط: حد أعلى ٦٠ للمرة، وفاصل ٣ ثواني بين كل إضافة
CREATE OR REPLACE FUNCTION add_points(p_id uuid, p_name text, p_points int, p_win boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pts int := greatest(0, least(coalesce(p_points, 0), 60));
  wk  text := _week_key();
  r   players%ROWTYPE;
BEGIN
  INSERT INTO players (id, name) VALUES (p_id, _clean_name(p_name)) ON CONFLICT (id) DO NOTHING;
  SELECT * INTO r FROM players WHERE id = p_id FOR UPDATE;
  IF r.last_at > now() - interval '3 seconds' THEN pts := 0; END IF;
  IF r.week_key <> wk THEN r.week_points := 0; END IF;

  UPDATE players SET
    name        = _clean_name(p_name),
    points      = r.points + pts,
    week_points = r.week_points + pts,
    week_key    = wk,
    wins        = r.wins + CASE WHEN p_win AND pts > 0 THEN 1 ELSE 0 END,
    last_at     = CASE WHEN pts > 0 THEN now() ELSE r.last_at END
  WHERE id = p_id
  RETURNING * INTO r;

  RETURN jsonb_build_object(
    'added', pts,
    'points', r.points,
    'week_points', r.week_points,
    'rank', (SELECT count(*) + 1 FROM players WHERE points > r.points),
    'week_rank', (SELECT count(*) + 1 FROM players WHERE week_key = wk AND week_points > r.week_points)
  );
END $$;

-- تغيير الاسم
CREATE OR REPLACE FUNCTION set_player_name(p_id uuid, p_name text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO players (id, name) VALUES (p_id, _clean_name(p_name))
  ON CONFLICT (id) DO UPDATE SET name = _clean_name(p_name);
$$;

-- الترتيب: أفضل ٥٠ + ترتيبك (بدون كشف معرّفات أحد)
CREATE OR REPLACE FUNCTION leaderboard(p_id uuid, p_scope text DEFAULT 'week')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wk   text := _week_key();
  top  jsonb;
  me   jsonb;
  mine int;
BEGIN
  IF p_scope = 'week' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.score DESC, x.last_at), '[]'::jsonb) INTO top FROM (
      SELECT id = p_id AS me, name, week_points AS score, wins, last_at
      FROM players WHERE week_key = wk AND week_points > 0
      ORDER BY week_points DESC, last_at LIMIT 50) x;
    SELECT CASE WHEN week_key = wk THEN week_points ELSE 0 END INTO mine FROM players WHERE id = p_id;
    me := jsonb_build_object('score', coalesce(mine, 0),
      'rank', (SELECT count(*) + 1 FROM players WHERE week_key = wk AND week_points > coalesce(mine, 0)),
      'name', (SELECT name FROM players WHERE id = p_id));
  ELSE
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.score DESC, x.last_at), '[]'::jsonb) INTO top FROM (
      SELECT id = p_id AS me, name, points AS score, wins, last_at
      FROM players WHERE points > 0
      ORDER BY points DESC, last_at LIMIT 50) x;
    SELECT points INTO mine FROM players WHERE id = p_id;
    me := jsonb_build_object('score', coalesce(mine, 0),
      'rank', (SELECT count(*) + 1 FROM players WHERE points > coalesce(mine, 0)),
      'name', (SELECT name FROM players WHERE id = p_id));
  END IF;
  RETURN jsonb_build_object('top', top, 'me', me,
    'players', (SELECT count(*) FROM players WHERE CASE WHEN p_scope = 'week' THEN week_key = wk AND week_points > 0 ELSE points > 0 END));
END $$;

NOTIFY pgrst, 'reload schema';
