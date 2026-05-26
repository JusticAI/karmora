-- ============================================
-- Karmora 社区数据库 Schema
-- 目标平台：Supabase (PostgreSQL)
-- ============================================

-- 启用必要扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID 生成
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- 模糊搜索（备用）
CREATE EXTENSION IF NOT EXISTS "vector";         -- 向量搜索（pgvector）

-- ============================================
-- 1. 社区主表
-- ============================================
CREATE TABLE communities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT UNIQUE NOT NULL,           -- 社区名 (如 "ecommerce")
    title           TEXT,                           -- 社区标题
    description     TEXT,                           -- 社区简介
    subscribers     INTEGER DEFAULT 0,              -- 订阅数
    active_users    INTEGER DEFAULT 0,              -- 活跃用户数
    over18          BOOLEAN DEFAULT FALSE,          -- NSFW 标记
    subreddit_type  TEXT DEFAULT 'public',          -- public/private/restricted
    category        TEXT,                           -- 分类 (ecommerce/tech/lifestyle...)
    badge           TEXT,                           -- 质量等级 (excellent/good/fair)
    lang            TEXT DEFAULT 'en',              -- 主要语言
    created_utc     BIGINT,                         -- Reddit 创建时间戳
    
    -- 元数据
    source          TEXT[],                         -- 数据来源标记
    rules_count     INTEGER DEFAULT 0,              -- 规则数量（冗余字段，加速查询）
    has_wiki        BOOLEAN DEFAULT FALSE,          -- 是否有 wiki 内容
    
    -- 时间戳
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 社区名索引（精确匹配）
CREATE INDEX idx_communities_name ON communities(name);

-- 订阅数索引（排序/筛选）
CREATE INDEX idx_communities_subscribers ON communities(subscribers DESC);

-- 分类索引
CREATE INDEX idx_communities_category ON communities(category);

-- ============================================
-- 2. 社区规则表
-- ============================================
CREATE TABLE community_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    
    -- 结构化规则内容
    rule_name       TEXT NOT NULL,                  -- 规则名称
    description     TEXT,                           -- 规则描述
    severity        TEXT DEFAULT 'info',            -- info / warning / ban
    examples        JSONB DEFAULT '[]'::jsonb,      -- 违规示例 ["示例1", "示例2"]
    keywords        JSONB DEFAULT '[]'::jsonb,      -- 关键词 ["spam", "self-promo"]
    
    -- 原始数据（保留备查）
    raw_html        TEXT,                           -- 原始 HTML
    raw_markdown    TEXT,                           -- 原始 Markdown
    source_url      TEXT,                           -- 来源 URL
    
    -- 排序
    display_order   INTEGER DEFAULT 0,              -- 显示顺序
    
    -- 时间戳
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 社区 ID 索引（关联查询）
CREATE INDEX idx_rules_community ON community_rules(community_id);

-- 严重程度索引
CREATE INDEX idx_rules_severity ON community_rules(severity);

-- ============================================
-- 3. 社区 Wiki 内容表
-- ============================================
CREATE TABLE community_wiki (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id    UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    
    -- 内容
    wiki_type       TEXT NOT NULL,                  -- 类型: intro / faq / posting_guide / welcome
    title           TEXT,                           -- 页面标题
    content         TEXT,                           -- 正文内容（Markdown）
    content_html    TEXT,                           -- HTML 版本
    
    -- 元数据
    source_url      TEXT,                           -- Reddit wiki URL
    last_edited_by  TEXT,                           -- 最后编辑者
    last_edited_at  TIMESTAMPTZ,                    -- Reddit 上的最后编辑时间
    
    -- 时间戳
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- 同一社区同一类型只有一条
    UNIQUE(community_id, wiki_type)
);

-- Wiki 关联索引
CREATE INDEX idx_wiki_community ON community_wiki(community_id);
CREATE INDEX idx_wiki_type ON community_wiki(wiki_type);

-- ============================================
-- 4. 全文搜索向量 + 索引
-- ============================================

-- 社区搜索向量字段
ALTER TABLE communities ADD COLUMN search_vector tsvector;

-- 社区搜索向量更新函数
CREATE OR REPLACE FUNCTION update_community_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 社区搜索向量触发器
CREATE TRIGGER trg_community_search_vector
    BEFORE INSERT OR UPDATE ON communities
    FOR EACH ROW
    EXECUTE FUNCTION update_community_search_vector();

-- 社区 GIN 索引（全文搜索核心）
CREATE INDEX idx_communities_search ON communities USING GIN(search_vector);

-- ============================================
-- 5. 向量搜索（pgvector，语义匹配）
-- ============================================

-- 社区语义向量字段（1536 维 = OpenAI text-embedding-3-small）
ALTER TABLE communities ADD COLUMN embedding vector(1536);

-- 向量索引（HNSW 算法，适合高维数据）
CREATE INDEX idx_communities_embedding ON communities 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- 规则搜索向量字段
ALTER TABLE community_rules ADD COLUMN search_vector tsvector;

-- 规则搜索向量更新函数
CREATE OR REPLACE FUNCTION update_rule_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', COALESCE(NEW.rule_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 规则搜索向量触发器
CREATE TRIGGER trg_rule_search_vector
    BEFORE INSERT OR UPDATE ON community_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_rule_search_vector();

-- 规则 GIN 索引
CREATE INDEX idx_rules_search ON community_rules USING GIN(search_vector);

-- ============================================
-- 6. 搜索函数
-- ============================================

-- 全文搜索社区（英文关键词）
CREATE OR REPLACE FUNCTION search_communities(
    query_text TEXT,
    result_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    community_id UUID,
    name TEXT,
    title TEXT,
    description TEXT,
    subscribers INTEGER,
    category TEXT,
    badge TEXT,
    relevance_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.title,
        c.description,
        c.subscribers,
        c.category,
        c.badge,
        ts_rank_cd(c.search_vector, websearch_to_tsquery('english', query_text))::REAL AS relevance_score
    FROM communities c
    WHERE c.search_vector @@ websearch_to_tsquery('english', query_text)
    ORDER BY relevance_score DESC, c.subscribers DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- 向量语义搜索社区（支持中英文）
CREATE OR REPLACE FUNCTION search_communities_semantic(
    query_embedding vector(1536),
    result_limit INTEGER DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
    community_id UUID,
    name TEXT,
    title TEXT,
    description TEXT,
    subscribers INTEGER,
    category TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.title,
        c.description,
        c.subscribers,
        c.category,
        (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity
    FROM communities c
    WHERE c.embedding IS NOT NULL
      AND (1 - (c.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- 搜索社区规则
CREATE OR REPLACE FUNCTION search_community_rules(
    community_name TEXT,
    query_text TEXT DEFAULT NULL
)
RETURNS TABLE (
    rule_id UUID,
    rule_name TEXT,
    description TEXT,
    severity TEXT,
    examples JSONB,
    keywords JSONB
) AS $$
BEGIN
    IF query_text IS NULL OR query_text = '' THEN
        -- 返回该社区所有规则
        RETURN QUERY
        SELECT 
            cr.id,
            cr.rule_name,
            cr.description,
            cr.severity,
            cr.examples,
            cr.keywords
        FROM community_rules cr
        JOIN communities c ON cr.community_id = c.id
        WHERE c.name = community_name
        ORDER BY cr.display_order, cr.created_at;
    ELSE
        -- 搜索该社区内匹配的规则
        RETURN QUERY
        SELECT 
            cr.id,
            cr.rule_name,
            cr.description,
            cr.severity,
            cr.examples,
            cr.keywords
        FROM community_rules cr
        JOIN communities c ON cr.community_id = c.id
        WHERE c.name = community_name
          AND cr.search_vector @@ websearch_to_tsquery('english', query_text)
        ORDER BY ts_rank_cd(cr.search_vector, websearch_to_tsquery('english', query_text)) DESC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. 辅助函数
-- ============================================

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_communities_updated_at
    BEFORE UPDATE ON communities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_rules_updated_at
    BEFORE UPDATE ON community_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_wiki_updated_at
    BEFORE UPDATE ON community_wiki
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 8. Row Level Security (RLS)
-- ============================================

-- 启用 RLS
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_wiki ENABLE ROW LEVEL SECURITY;

-- 公开读取策略（任何人可查）
CREATE POLICY "Public read access" ON communities
    FOR SELECT USING (true);

CREATE POLICY "Public read access" ON community_rules
    FOR SELECT USING (true);

CREATE POLICY "Public read access" ON community_wiki
    FOR SELECT USING (true);

-- 写入需要认证（service_role key）
CREATE POLICY "Service role write" ON communities
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role write" ON community_rules
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role write" ON community_wiki
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 9. 统计视图
-- ============================================

CREATE VIEW community_stats AS
SELECT 
    COUNT(*) as total_communities,
    COUNT(*) FILTER (WHERE subscribers > 1000000) as mega_communities,
    COUNT(*) FILTER (WHERE subscribers BETWEEN 100000 AND 1000000) as large_communities,
    COUNT(*) FILTER (WHERE subscribers BETWEEN 10000 AND 100000) as medium_communities,
    COUNT(*) FILTER (WHERE subscribers BETWEEN 1000 AND 10000) as small_communities,
    COUNT(*) FILTER (WHERE subscribers < 1000) as tiny_communities,
    COUNT(DISTINCT category) as total_categories,
    SUM(subscribers) as total_subscribers
FROM communities;

CREATE VIEW rules_stats AS
SELECT 
    c.name as community_name,
    COUNT(cr.id) as rule_count,
    COUNT(cr.id) FILTER (WHERE cr.severity = 'ban') as ban_rules,
    COUNT(cr.id) FILTER (WHERE cr.severity = 'warning') as warning_rules,
    COUNT(cr.id) FILTER (WHERE cr.severity = 'info') as info_rules
FROM communities c
LEFT JOIN community_rules cr ON c.id = cr.community_id
GROUP BY c.name
ORDER BY rule_count DESC;

-- ============================================
-- 完成提示
-- ============================================
-- Schema 创建完成！
-- 下一步：
-- 1. 在 Supabase 创建项目
-- 2. 在 SQL Editor 中执行此脚本
-- 3. 运行数据导入脚本
