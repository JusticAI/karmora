-- ============================================
-- Karmora 内测申请系统
-- ============================================

-- 创建申请状态枚举
DO $$ BEGIN
    CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 内测申请表
CREATE TABLE IF NOT EXISTS applications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT UNIQUE NOT NULL,
    status          application_status DEFAULT 'pending',
    token           TEXT UNIQUE,                           -- 登录令牌（审核通过时生成）
    source          TEXT DEFAULT 'landing',                 -- 来源（landing / admin）
    notes           TEXT,                                   -- 审核备注
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    approved_at     TIMESTAMPTZ,
    approved_by     TEXT,                                   -- 审核人
    last_login_at   TIMESTAMPTZ                             -- 最后登录时间
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_applications_email ON applications(email);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_token ON applications(token);

-- 启用 RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- 公开策略：任何人都可以插入（提交申请）
CREATE POLICY "Anyone can apply" ON applications
    FOR INSERT WITH CHECK (true);

-- 公开策略：只有通过 token 可读自己的记录
CREATE POLICY "Read own application with token" ON applications
    FOR SELECT USING (token = current_setting('app.token', true));

-- 只有 service_role 可读所有记录
CREATE POLICY "Service role can read all" ON applications
    FOR SELECT USING (auth.role() = 'service_role');

-- 只有 service_role 可更新
CREATE POLICY "Service role can update" ON applications
    FOR UPDATE USING (auth.role() = 'service_role');

-- 自动更新 approved_at
CREATE OR REPLACE FUNCTION update_approved_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        NEW.approved_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_applications_approved ON applications;
CREATE TRIGGER trg_applications_approved
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_approved_at();

-- 自动生成 token
CREATE OR REPLACE FUNCTION generate_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.token IS NULL THEN
        NEW.token = encode(gen_random_bytes(32), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_applications_token ON applications;
CREATE TRIGGER trg_applications_token
    BEFORE INSERT ON applications
    FOR EACH ROW
    EXECUTE FUNCTION generate_token();
