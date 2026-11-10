-- ========================================
-- ترقية v3: حذف الغرف القديمة تلقائياً (كل ساعة)
-- شغّله بعد supabase-migration-v2.sql — مرة وحدة في SQL Editor
--
-- سياسة الخصوصية في التطبيق تقول إن الغرف القديمة تنحذف تلقائياً،
-- وهذا الملف هو اللي يخليها حقيقية.
-- ========================================

-- pg_cron متوفر في Supabase (Database → Extensions → pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- الدالة موجودة في السكيما الأصلية؛ نعيد تعريفها هنا احتياطاً
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM rooms WHERE updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- جدولة: كل ساعة عند الدقيقة 0 (لو كانت موجودة تنحذف وتنضاف من جديد)
SELECT cron.unschedule('cleanup-old-rooms')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-rooms');

SELECT cron.schedule('cleanup-old-rooms', '0 * * * *', $$SELECT cleanup_old_rooms()$$);
