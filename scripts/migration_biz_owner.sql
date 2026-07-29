-- 给 daily_reports 表加 biz_owner 字段
ALTER TABLE daily_reports ADD COLUMN biz_owner TEXT DEFAULT '';
