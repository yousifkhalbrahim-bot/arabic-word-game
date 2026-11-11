-- ========================================
-- ترقية v6: فلتر الكلمات المسيئة على السيرفر
-- شغّله مرة وحدة في SQL Editor (آمن لإعادة التشغيل)
--
-- نفس منطق lib/profanity.js: لو أحد تحايل على التطبيق وأرسل اسم
-- مسيء، السيرفر يحطه "لاعب"، ويشيل التلميح المسيء من الغرف.
-- ========================================

CREATE OR REPLACE FUNCTION _norm_filter(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
           translate(
             regexp_replace(lower(coalesce(t, '')), '[ً-ٰٟـ]', '', 'g'),
             'أإآىة@0$5', 'اااياهaoss'),
           '(.)\1+', '\1', 'g')
$$;

CREATE OR REPLACE FUNCTION _is_bad(t text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  n text := _norm_filter(t);
  squashed text := regexp_replace(n, '[^a-zء-ي]', '', 'g');
  tok text;
  bare text;
  whole text[] := ARRAY['كس','كسم','زب','زبي','زبر','طيز','نيك','نيج','نايك','عير','عيري','خول','عرص','مص',
    'خرا','خره','زنا','زاني','عاهر','لوطي','شاذ','ديوث','قواد','منيك','سكس','بورن','كحبه',
    'fuck','fck','fuk','shit','bitch','dick','cock','pussy','cunt','ass','asshole','whore',
    'slut','porn','sex','fag','nigger','nigga','rape','penis','boobs'];
  sub text[] := ARRAY['كسمك','كسامك','كسختك','كسخت','كسيس','منيوك','منيوكه','متناك','شرموط','قحبه','قحاب',
    'عاهره','معرص','مخنث','زانيه','طيزك','زبك','نيكني','نيكم','يلعن','سكسي',
    'بورنو','مومس','دعاره','ابنالكلب','ياكلب','ياحمار','يازق',
    'fuck','shit','bitch','pussy','cunt','asshole','whore','porn','nigger','nigga','motherf'];
  w text;
BEGIN
  IF n = '' THEN RETURN false; END IF;
  FOREACH w IN ARRAY sub LOOP
    IF position(_norm_filter(w) IN squashed) > 0 THEN RETURN true; END IF;
  END LOOP;
  FOREACH tok IN ARRAY regexp_split_to_array(n, '[^a-zء-ي]+') LOOP
    IF tok = '' THEN CONTINUE; END IF;
    bare := regexp_replace(tok, '^(و|ف|ب|ل|ك)?(ال)?', '');
    IF tok = ANY(whole) OR bare = ANY(whole) THEN RETURN true; END IF;
  END LOOP;
  RETURN false;
END $$;

-- الأسماء في الترتيب
CREATE OR REPLACE FUNCTION _clean_name(p_name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN left(btrim(coalesce(p_name, '')), 20) = '' OR _is_bad(p_name) THEN 'لاعب'
              ELSE left(btrim(p_name), 20) END
$$;

-- الاسم عند دخول غرفة
CREATE OR REPLACE FUNCTION room_join(p_code text, p_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s jsonb; t bigint := now_ms();
BEGIN
  SELECT state INTO s FROM rooms WHERE code = p_code FOR UPDATE;
  IF s IS NULL THEN RETURN _res(false, 'missing', NULL); END IF;
  IF coalesce((s->'players'->'2'->>'joined')::boolean, false) THEN
    RETURN _res(false, 'full', s);
  END IF;
  s := jsonb_set(s, '{players,2}', jsonb_build_object('name', _clean_name(p_name), 'joined', true));
  s := jsonb_set(s, '{status}', '"playing"');
  IF s->>'mode' = 'race' THEN
    s := jsonb_set(s, '{gameStartedAt}', to_jsonb(t));
  ELSE
    s := jsonb_set(s, '{turnStartedAt}', to_jsonb(t));
  END IF;
  RETURN _res(true, NULL, _room_save(p_code, s));
END $$;

-- اسم المضيف والتلميح عند إنشاء غرفة
CREATE OR REPLACE FUNCTION room_create(p_code text, p_state jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_code !~ '^[0-9]{4}$' THEN RETURN false; END IF;
  p_state := jsonb_set(p_state, '{players,1,name}', to_jsonb(_clean_name(p_state->'players'->'1'->>'name')));
  IF p_state ? 'clue' AND _is_bad(p_state->>'clue') THEN
    p_state := jsonb_set(p_state, '{clue}', '""');
  END IF;
  DELETE FROM rooms WHERE code = p_code AND updated_at < now() - interval '24 hours';
  INSERT INTO rooms (code, state, updated_at) VALUES (p_code, p_state, now());
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END $$;

-- تنظيف أي أسماء مسيئة موجودة
UPDATE players SET name = 'لاعب' WHERE _is_bad(name);

NOTIFY pgrst, 'reload schema';
