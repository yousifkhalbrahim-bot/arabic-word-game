-- ========================================
-- ترقية v2: عمليات ذرّية على السيرفر + توقيت موحّد
-- شغّل هذا الملف مرة واحدة في SQL Editor في Supabase
-- (آمن لإعادة التشغيل)
--
-- لماذا؟ سابقاً كل لاعب يحفظ حالة الغرفة كاملة، فإذا تصرّف اللاعبان
-- في نفس اللحظة، الحفظ الأخير يمسح تغييرات الآخر (كلمات تختفي،
-- عقوبات تنمسح...). الآن كل إجراء يتم داخل دالة تقفل الصف وتعدّل
-- الجزء المطلوب فقط، والوقت يُؤخذ من ساعة السيرفر.
-- ========================================

-- ---------- الوقت ----------
CREATE OR REPLACE FUNCTION now_ms() RETURNS bigint
LANGUAGE sql VOLATILE AS $$
  SELECT (extract(epoch FROM clock_timestamp()) * 1000)::bigint
$$;

-- يستخدمه العميل لمزامنة ساعته مع السيرفر
CREATE OR REPLACE FUNCTION server_now() RETURNS bigint
LANGUAGE sql VOLATILE AS $$
  SELECT now_ms()
$$;

-- ---------- مساعدات ----------
-- يحفظ الحالة ويرفع رقم النسخة (version) — كل كتابة لازم تمر من هنا
CREATE OR REPLACE FUNCTION _room_save(p_code text, s jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
BEGIN
  s := jsonb_set(s, '{version}', to_jsonb(coalesce((s->>'version')::int, 0) + 1));
  UPDATE rooms SET state = s, updated_at = now() WHERE code = p_code;
  RETURN s;
END $$;

CREATE OR REPLACE FUNCTION _res(p_ok boolean, p_reason text, p_state jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('ok', p_ok, 'reason', p_reason, 'state', p_state)
$$;

-- نقاط لاعب في السباق = عدد كلماته - العقوبات
CREATE OR REPLACE FUNCTION _race_score(s jsonb, r int) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_array_length(s->('words_p' || r)), 0)
       - coalesce((s->'penalties'->>(r::text))::int, 0)
$$;

-- سبب منع اللاعب من التصرف الآن (NULL = مسموح)
CREATE OR REPLACE FUNCTION _race_block_reason(s jsonb, r int) RETURNS text
LANGUAGE plpgsql VOLATILE AS $$
DECLARE t bigint := now_ms();
BEGIN
  IF s IS NULL THEN RETURN 'missing'; END IF;
  IF s->>'status' IS DISTINCT FROM 'playing' THEN RETURN 'not_playing'; END IF;
  -- سماحية ثانية واحدة لتأخير الشبكة
  IF t > (s->>'gameStartedAt')::bigint + (s->'settings'->>'duration')::bigint * 1000 + 1000 THEN
    RETURN 'time_up';
  END IF;
  IF coalesce((s->'frozenUntil'->>(r::text))::bigint, 0) > t + 300 THEN RETURN 'frozen'; END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION _ensure_race_maps(s jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_set(
           jsonb_set(s, '{penalties}', coalesce(s->'penalties', '{"1":0,"2":0}'::jsonb)),
           '{frozenUntil}', coalesce(s->'frozenUntil', '{"1":null,"2":null}'::jsonb))
$$;

-- ---------- الانضمام ----------
CREATE OR REPLACE FUNCTION room_join(p_code text, p_name text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE s jsonb; t bigint := now_ms();
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  IF s IS NULL THEN RETURN _res(false, 'missing', NULL); END IF;
  IF coalesce((s->'players'->'2'->>'joined')::boolean, false) THEN
    RETURN _res(false, 'full', s);
  END IF;
  s := jsonb_set(s, '{players,2}', jsonb_build_object('name', p_name, 'joined', true));
  s := jsonb_set(s, '{status}', '"playing"');
  IF s->>'mode' = 'race' THEN
    s := jsonb_set(s, '{gameStartedAt}', to_jsonb(t));
  ELSE
    s := jsonb_set(s, '{turnStartedAt}', to_jsonb(t));
  END IF;
  RETURN _res(true, NULL, _room_save(p_code, s));
END $$;

-- ---------- المغادرة ----------
CREATE OR REPLACE FUNCTION room_leave(p_code text, p_role int) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE s jsonb;
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  IF s IS NULL THEN RETURN _res(false, 'missing', NULL); END IF;
  s := jsonb_set(s, ARRAY['players', p_role::text, 'left'], 'true'::jsonb);
  RETURN _res(true, NULL, _room_save(p_code, s));
END $$;

-- ---------- كتابة مشروطة (ساعة الشطرنج) ----------
-- تنجح فقط إذا ما تغيّرت الغرفة منذ آخر نسخة شافها العميل.
-- p_stamp: اسم حقل يُعبّأ بوقت السيرفر (مثل turnStartedAt)
CREATE OR REPLACE FUNCTION room_cas(p_code text, p_version int, p_state jsonb, p_stamp text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE s jsonb;
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  IF s IS NULL THEN RETURN _res(false, 'missing', NULL); END IF;
  IF coalesce((s->>'version')::int, 0) <> p_version THEN
    RETURN _res(false, 'conflict', s);
  END IF;
  IF p_stamp IS NOT NULL THEN
    p_state := jsonb_set(p_state, ARRAY[p_stamp], to_jsonb(now_ms()));
  END IF;
  p_state := jsonb_set(p_state, '{version}', to_jsonb(p_version));
  RETURN _res(true, NULL, _room_save(p_code, p_state));
END $$;

-- ---------- جولة جديدة ----------
-- أول من يضغط "جولة ثانية" يبدأها؛ الضغطة الثانية ترجع نفس الجولة
CREATE OR REPLACE FUNCTION room_rematch(p_code text, p_game_number int, p_state jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE s jsonb; t bigint := now_ms();
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  IF s IS NULL THEN RETURN _res(false, 'missing', NULL); END IF;
  IF coalesce((s->>'gameNumber')::int, 1) <> p_game_number THEN
    RETURN _res(false, 'already_started', s);
  END IF;
  IF p_state->>'mode' = 'race' THEN
    p_state := jsonb_set(p_state, '{gameStartedAt}', to_jsonb(t));
  ELSE
    p_state := jsonb_set(p_state, '{turnStartedAt}', to_jsonb(t));
  END IF;
  p_state := jsonb_set(p_state, '{version}', to_jsonb(coalesce((s->>'version')::int, 0)));
  RETURN _res(true, NULL, _room_save(p_code, p_state));
END $$;

-- ---------- السباق: إرسال كلمة ----------
-- p_index: رقم السؤال الذي يجيب عليه اللاعب. إذا سبقه الخصم يرجع 'stale'
CREATE OR REPLACE FUNCTION race_submit(p_code text, p_role int, p_word text, p_index int) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  s jsonb; t bigint := now_ms(); k text := 'words_p' || p_role;
  reason text; q jsonb; ending text;
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  reason := _race_block_reason(s, p_role);
  IF reason IS NOT NULL THEN RETURN _res(false, reason, s); END IF;
  IF (s->>'currentEndingIndex')::int <> p_index THEN RETURN _res(false, 'stale', s); END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(s->'words_p1', '[]') || coalesce(s->'words_p2', '[]')) e
    WHERE jsonb_typeof(e) = 'object' AND e->>'w' = p_word
  ) THEN
    RETURN _res(false, 'used', s);
  END IF;
  q := s->'endingQueue';
  ending := q->>(p_index % greatest(jsonb_array_length(q), 1));
  s := jsonb_set(s, ARRAY[k], coalesce(s->k, '[]'::jsonb)
         || jsonb_build_array(jsonb_build_object('w', p_word, 'ts', t, 'ending', ending)));
  s := jsonb_set(s, '{currentEndingIndex}', to_jsonb(p_index + 1));
  RETURN _res(true, NULL, _room_save(p_code, s));
END $$;

-- ---------- السباق: تجاوز السؤال (-1) ----------
CREATE OR REPLACE FUNCTION race_skip(p_code text, p_role int, p_index int) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE s jsonb; reason text; r text := p_role::text;
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  reason := _race_block_reason(s, p_role);
  IF reason IS NOT NULL THEN RETURN _res(false, reason, s); END IF;
  IF (s->>'currentEndingIndex')::int <> p_index THEN RETURN _res(false, 'stale', s); END IF;
  IF _race_score(s, p_role) < 1 THEN RETURN _res(false, 'no_points', s); END IF;
  s := _ensure_race_maps(s);
  s := jsonb_set(s, ARRAY['penalties', r], to_jsonb(coalesce((s->'penalties'->>r)::int, 0) + 1));
  s := jsonb_set(s, '{currentEndingIndex}', to_jsonb(p_index + 1));
  RETURN _res(true, NULL, _room_save(p_code, s));
END $$;

-- ---------- السباق: تجميد الخصم ٥ ثوانٍ (-3) ----------
CREATE OR REPLACE FUNCTION race_freeze(p_code text, p_role int) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE s jsonb; reason text; t bigint := now_ms(); r text := p_role::text; o text := (3 - p_role)::text;
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  reason := _race_block_reason(s, p_role);
  IF reason IS NOT NULL THEN RETURN _res(false, reason, s); END IF;
  IF _race_score(s, p_role) < 3 THEN RETURN _res(false, 'no_points', s); END IF;
  s := _ensure_race_maps(s);
  IF coalesce((s->'frozenUntil'->>o)::bigint, 0) > t THEN RETURN _res(false, 'opp_frozen', s); END IF;
  s := jsonb_set(s, ARRAY['frozenUntil', o], to_jsonb(t + 5000));
  s := jsonb_set(s, ARRAY['penalties', r], to_jsonb(coalesce((s->'penalties'->>r)::int, 0) + 3));
  RETURN _res(true, NULL, _room_save(p_code, s));
END $$;

-- ---------- السباق: إنهاء عند انتهاء الوقت ----------
CREATE OR REPLACE FUNCTION race_finish(p_code text) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE s jsonb; t bigint := now_ms(); a int; b int;
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  IF s IS NULL THEN RETURN _res(false, 'missing', NULL); END IF;
  IF s->>'status' = 'finished' THEN RETURN _res(true, NULL, s); END IF;
  IF s->>'status' IS DISTINCT FROM 'playing' THEN RETURN _res(false, 'not_playing', s); END IF;
  IF t < (s->>'gameStartedAt')::bigint + (s->'settings'->>'duration')::bigint * 1000 - 250 THEN
    RETURN _res(false, 'not_yet', s);
  END IF;
  a := _race_score(s, 1);
  b := _race_score(s, 2);
  s := jsonb_set(s, '{status}', '"finished"');
  s := jsonb_set(s, '{winner}', to_jsonb(CASE WHEN a = b THEN 0 WHEN a > b THEN 1 ELSE 2 END));
  RETURN _res(true, NULL, _room_save(p_code, s));
END $$;

-- ---------- السباق: استسلام ----------
CREATE OR REPLACE FUNCTION race_resign(p_code text, p_role int) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE s jsonb;
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  IF s IS NULL THEN RETURN _res(false, 'missing', NULL); END IF;
  IF s->>'status' IS DISTINCT FROM 'playing' THEN RETURN _res(false, 'not_playing', s); END IF;
  s := jsonb_set(s, '{status}', '"finished"');
  s := jsonb_set(s, '{winner}', to_jsonb(3 - p_role));
  s := jsonb_set(s, '{resigned}', to_jsonb(p_role));
  RETURN _res(true, NULL, _room_save(p_code, s));
END $$;

-- إعادة تحميل الكاش في PostgREST حتى تظهر الدوال الجديدة فوراً
NOTIFY pgrst, 'reload schema';
