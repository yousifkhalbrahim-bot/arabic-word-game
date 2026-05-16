-- ========================================
-- سكيما قاعدة بيانات لعبة الكلمات العربية
-- شغّل هذا في SQL Editor في Supabase
-- ========================================

-- جدول الغرف
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهرس على updated_at لحذف الغرف القديمة لاحقاً
CREATE INDEX IF NOT EXISTS rooms_updated_at_idx ON rooms (updated_at);

-- تفعيل Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- سياسات: السماح للجميع بالقراءة والكتابة (لعبة بسيطة بدون مصادقة)
DROP POLICY IF EXISTS "anyone can read rooms" ON rooms;
CREATE POLICY "anyone can read rooms" ON rooms FOR SELECT USING (true);

DROP POLICY IF EXISTS "anyone can insert rooms" ON rooms;
CREATE POLICY "anyone can insert rooms" ON rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anyone can update rooms" ON rooms;
CREATE POLICY "anyone can update rooms" ON rooms FOR UPDATE USING (true);

DROP POLICY IF EXISTS "anyone can delete rooms" ON rooms;
CREATE POLICY "anyone can delete rooms" ON rooms FOR DELETE USING (true);

-- تفعيل Realtime على الجدول (لتلقي التحديثات اللحظية)
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- دالة لحذف الغرف القديمة (أكثر من 24 ساعة)
-- يمكنك تشغيلها يدوياً أو جدولتها عبر pg_cron
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM rooms WHERE updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
