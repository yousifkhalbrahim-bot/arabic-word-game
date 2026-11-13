-- ========================================
-- ترقية v8: الستريك في المتصدرين 🔥
-- شغّله مرة وحدة في SQL Editor (آمن لإعادة التشغيل)
--
-- كل لاعب يرسل ستريكه الحالي في «خمّن الكلمة» بعد كل جولة،
-- والمتصدرين يعرضونه جنب النقاط.
-- ========================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS streak int NOT NULL DEFAULT 0;

-- تحديث الستريك (بين 0 و 999)
CREATE OR REPLACE FUNCTION set_streak(p_id uuid, p_name text, p_streak int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO players (id, name) VALUES (p_id, _clean_name(p_name)) ON CONFLICT (id) DO NOTHING;
  UPDATE players SET streak = greatest(0, least(coalesce(p_streak, 0), 999)) WHERE id = p_id;
END $$;

REVOKE ALL ON FUNCTION set_streak(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_streak(uuid, text, int) TO anon, authenticated;

-- المتصدرين: نفس السابق + الستريك
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
      SELECT id = p_id AS me, name, week_points AS score, wins, streak, last_at
      FROM players WHERE week_key = wk AND week_points > 0
      ORDER BY week_points DESC, last_at LIMIT 50) x;
    SELECT CASE WHEN week_key = wk THEN week_points ELSE 0 END INTO mine FROM players WHERE id = p_id;
  ELSE
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.score DESC, x.last_at), '[]'::jsonb) INTO top FROM (
      SELECT id = p_id AS me, name, points AS score, wins, streak, last_at
      FROM players WHERE points > 0
      ORDER BY points DESC, last_at LIMIT 50) x;
    SELECT points INTO mine FROM players WHERE id = p_id;
  END IF;
  me := jsonb_build_object('score', coalesce(mine, 0),
    'rank', CASE WHEN p_scope = 'week'
      THEN (SELECT count(*) + 1 FROM players WHERE week_key = wk AND week_points > coalesce(mine, 0))
      ELSE (SELECT count(*) + 1 FROM players WHERE points > coalesce(mine, 0)) END,
    'name', (SELECT name FROM players WHERE id = p_id),
    'streak', (SELECT streak FROM players WHERE id = p_id));
  RETURN jsonb_build_object('top', top, 'me', me,
    'players', (SELECT count(*) FROM players WHERE CASE WHEN p_scope = 'week' THEN week_key = wk AND week_points > 0 ELSE points > 0 END));
END $$;

NOTIFY pgrst, 'reload schema';
