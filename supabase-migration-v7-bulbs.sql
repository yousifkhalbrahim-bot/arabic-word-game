-- ========================================
-- ترقية v7: لمبات التلميح 💡 على السيرفر
-- شغّله مرة وحدة في SQL Editor (آمن لإعادة التشغيل)
--
-- كل لاعب له رصيد لمبات (يبدأ ٣، أقصى ٩). يصرفها على التلميحات
-- ويكسبها بالفوز. الكسب محمي: ٢ بالكثير كل مرة، مرة كل ٥ ثواني،
-- و١٥ بالكثير باليوم — عشان ما أحد يعبّي رصيده بطلبات مباشرة.
-- ========================================

ALTER TABLE players ADD COLUMN IF NOT EXISTS bulbs int NOT NULL DEFAULT 3;
ALTER TABLE players ADD COLUMN IF NOT EXISTS bulbs_at timestamptz NOT NULL DEFAULT (now() - interval '1 hour');
ALTER TABLE players ADD COLUMN IF NOT EXISTS bulbs_day_key text NOT NULL DEFAULT '';
ALTER TABLE players ADD COLUMN IF NOT EXISTS bulbs_day_earned int NOT NULL DEFAULT 0;

-- الرصيد (بدون ما ينشئ لاعب جديد)
CREATE OR REPLACE FUNCTION bulbs_get(p_id uuid) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT bulbs FROM players WHERE id = p_id), 3)
$$;

-- صرف لمبات على تلميح (السعر ١ أو ٢ بس)
CREATE OR REPLACE FUNCTION bulbs_spend(p_id uuid, p_name text, p_cost int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b int;
BEGIN
  IF p_cost NOT IN (1, 2) THEN RETURN jsonb_build_object('ok', false, 'bulbs', bulbs_get(p_id)); END IF;
  INSERT INTO players (id, name) VALUES (p_id, _clean_name(p_name)) ON CONFLICT (id) DO NOTHING;
  SELECT bulbs INTO b FROM players WHERE id = p_id FOR UPDATE;
  IF b < p_cost THEN RETURN jsonb_build_object('ok', false, 'bulbs', b); END IF;
  UPDATE players SET bulbs = b - p_cost WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'bulbs', b - p_cost);
END $$;

-- كسب لمبات بعد الفوز
CREATE OR REPLACE FUNCTION bulbs_earn(p_id uuid, p_name text, p_amount int) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  amt int := greatest(0, least(coalesce(p_amount, 0), 2));
  dk  text := to_char(now() AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD');
  r   players%ROWTYPE;
BEGIN
  INSERT INTO players (id, name) VALUES (p_id, _clean_name(p_name)) ON CONFLICT (id) DO NOTHING;
  SELECT * INTO r FROM players WHERE id = p_id FOR UPDATE;
  IF r.bulbs_day_key <> dk THEN r.bulbs_day_earned := 0; END IF;
  IF r.bulbs_at > now() - interval '5 seconds' THEN amt := 0; END IF;
  amt := greatest(0, least(amt, 15 - r.bulbs_day_earned, 9 - r.bulbs));
  UPDATE players SET
    bulbs            = r.bulbs + amt,
    bulbs_day_key    = dk,
    bulbs_day_earned = r.bulbs_day_earned + amt,
    bulbs_at         = CASE WHEN amt > 0 THEN now() ELSE r.bulbs_at END
  WHERE id = p_id;
  RETURN jsonb_build_object('added', amt, 'bulbs', r.bulbs + amt);
END $$;

REVOKE ALL ON FUNCTION bulbs_get(uuid), bulbs_spend(uuid, text, int), bulbs_earn(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bulbs_get(uuid), bulbs_spend(uuid, text, int), bulbs_earn(uuid, text, int) TO anon, authenticated;


-- ملفي: كل معلومات اللاعب في طلب واحد
CREATE OR REPLACE FUNCTION player_profile(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r  players%ROWTYPE;
  wk text := _week_key();
  wp int;
BEGIN
  SELECT * INTO r FROM players WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false, 'bulbs', 3, 'points', 0, 'week_points', 0, 'wins', 0,
      'players', (SELECT count(*) FROM players WHERE points > 0));
  END IF;
  wp := CASE WHEN r.week_key = wk THEN r.week_points ELSE 0 END;
  RETURN jsonb_build_object(
    'exists', true,
    'name', r.name,
    'points', r.points,
    'week_points', wp,
    'wins', r.wins,
    'bulbs', r.bulbs,
    'since', r.created_at,
    'rank', CASE WHEN r.points > 0 THEN (SELECT count(*) + 1 FROM players WHERE points > r.points) END,
    'week_rank', CASE WHEN wp > 0 THEN (SELECT count(*) + 1 FROM players WHERE week_key = wk AND week_points > wp) END,
    'players', (SELECT count(*) FROM players WHERE points > 0)
  );
END $$;

GRANT EXECUTE ON FUNCTION player_profile(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
