-- ========================================
-- ترقية v5: حماية الغرف + إصلاحات من المراجعة
-- شغّله مرة وحدة في SQL Editor (آمن لإعادة التشغيل)
--
-- - إنشاء/إلغاء الغرف صار عن طريق دوال بس، والكتابة/الحذف المباشر على
--   جدول rooms انقفل (القراءة باقية عشان التحديث اللحظي).
-- - "جولة ثانية" ما ترجّع لاعب طلع، وتتحقق إن الجولة خلصت.
-- - الطلوع وقت اختيار الكلمة/اللعب ينهي الجولة لصالح الثاني.
-- - حد يومي للنقاط (٦٠٠) + رد واضح لو انرفضت بسبب السرعة.
-- ========================================

-- ---------- إنشاء غرفة (بدون الكتابة فوق غرفة موجودة) ----------
CREATE OR REPLACE FUNCTION room_create(p_code text, p_state jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_code !~ '^[0-9]{4}$' THEN RETURN false; END IF;
  -- غرفة قديمة (أكثر من ٢٤ ساعة) بنفس الكود؟ نحذفها
  DELETE FROM rooms WHERE code = p_code AND updated_at < now() - interval '24 hours';
  INSERT INTO rooms (code, state, updated_at) VALUES (p_code, p_state, now());
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END $$;

-- ---------- إلغاء غرفة انتظار (بس إذا ما دخل أحد) ----------
CREATE OR REPLACE FUNCTION room_cancel(p_code text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (DELETE FROM rooms WHERE code = p_code AND state->>'status' = 'waiting' RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM d)
$$;

-- ---------- المغادرة: لو الجولة شغّالة، تنتهي لصالح الثاني ----------
CREATE OR REPLACE FUNCTION room_leave(p_code text, p_role int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb;
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  IF s IS NULL THEN RETURN _res(false, 'missing', NULL); END IF;
  s := jsonb_set(s, ARRAY['players', p_role::text, 'left'], 'true'::jsonb);
  IF s->>'status' IN ('playing', 'choosing') THEN
    s := jsonb_set(s, '{status}', '"finished"');
    s := jsonb_set(s, '{winner}', to_jsonb(3 - p_role));
    s := jsonb_set(s, '{resigned}', to_jsonb(p_role));
  END IF;
  RETURN _res(true, NULL, _room_save(p_code, s));
END $$;

-- ---------- جولة ثانية: بس بعد ما تخلص، وما أحد طالع، واللاعبين من السيرفر ----------
CREATE OR REPLACE FUNCTION room_rematch(p_code text, p_game_number int, p_state jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb; t bigint := now_ms();
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  IF s IS NULL THEN RETURN _res(false, 'missing', NULL); END IF;
  IF coalesce((s->>'gameNumber')::int, 1) <> p_game_number THEN
    RETURN _res(false, 'already_started', s);
  END IF;
  IF s->>'status' IS DISTINCT FROM 'finished' THEN RETURN _res(false, 'not_finished', s); END IF;
  IF coalesce((s->'players'->'1'->>'left')::boolean, false)
     OR coalesce((s->'players'->'2'->>'left')::boolean, false) THEN
    RETURN _res(false, 'left', s);
  END IF;
  p_state := jsonb_set(p_state, '{players}', s->'players');
  IF p_state->>'mode' = 'race' THEN
    p_state := jsonb_set(p_state, '{gameStartedAt}', to_jsonb(t));
  ELSE
    p_state := jsonb_set(p_state, '{turnStartedAt}', to_jsonb(t));
  END IF;
  p_state := jsonb_set(p_state, '{version}', to_jsonb(coalesce((s->>'version')::int, 0)));
  RETURN _res(true, NULL, _room_save(p_code, p_state));
END $$;

-- ---------- كل دوال الغرف تشتغل بصلاحية الخادم ----------
ALTER FUNCTION _room_save(text, jsonb)                SECURITY DEFINER SET search_path = public;
ALTER FUNCTION room_join(text, text)                  SECURITY DEFINER SET search_path = public;
ALTER FUNCTION room_cas(text, int, jsonb, text)       SECURITY DEFINER SET search_path = public;
ALTER FUNCTION race_submit(text, int, text, int)      SECURITY DEFINER SET search_path = public;
ALTER FUNCTION race_skip(text, int, int)              SECURITY DEFINER SET search_path = public;
ALTER FUNCTION race_freeze(text, int)                 SECURITY DEFINER SET search_path = public;
ALTER FUNCTION race_finish(text)                      SECURITY DEFINER SET search_path = public;
ALTER FUNCTION race_resign(text, int)                 SECURITY DEFINER SET search_path = public;

-- ---------- قفل الكتابة المباشرة على جدول الغرف ----------
DROP POLICY IF EXISTS "anyone can insert rooms" ON rooms;
DROP POLICY IF EXISTS "anyone can update rooms" ON rooms;
DROP POLICY IF EXISTS "anyone can delete rooms" ON rooms;
-- (القراءة باقية: "anyone can read rooms" — يحتاجها التحديث اللحظي)

-- ---------- النقاط: حد يومي ----------
ALTER TABLE players ADD COLUMN IF NOT EXISTS day_key text NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS day_points int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION add_points(p_id uuid, p_name text, p_points int, p_win boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pts int := greatest(0, least(coalesce(p_points, 0), 60));
  wk  text := _week_key();
  dk  text := to_char(now() AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD');
  daily_cap int := 600;
  throttled boolean := false;
  r   players%ROWTYPE;
BEGIN
  INSERT INTO players (id, name) VALUES (p_id, _clean_name(p_name)) ON CONFLICT (id) DO NOTHING;
  SELECT * INTO r FROM players WHERE id = p_id FOR UPDATE;
  IF r.last_at > now() - interval '3 seconds' THEN pts := 0; throttled := true; END IF;
  IF r.week_key <> wk THEN r.week_points := 0; END IF;
  IF r.day_key <> dk THEN r.day_points := 0; END IF;
  pts := greatest(0, least(pts, daily_cap - r.day_points));

  UPDATE players SET
    name        = _clean_name(p_name),
    points      = r.points + pts,
    week_points = r.week_points + pts,
    week_key    = wk,
    day_points  = r.day_points + pts,
    day_key     = dk,
    wins        = r.wins + CASE WHEN p_win AND pts > 0 THEN 1 ELSE 0 END,
    last_at     = CASE WHEN pts > 0 THEN now() ELSE r.last_at END
  WHERE id = p_id
  RETURNING * INTO r;

  RETURN jsonb_build_object(
    'added', pts,
    'throttled', throttled,
    'points', r.points,
    'week_points', r.week_points,
    'rank', (SELECT count(*) + 1 FROM players WHERE points > r.points),
    'week_rank', (SELECT count(*) + 1 FROM players WHERE week_key = wk AND week_points > r.week_points)
  );
END $$;

NOTIFY pgrst, 'reload schema';
