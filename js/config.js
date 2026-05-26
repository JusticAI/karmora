// Karmora 配置
// ⚠️ 部署到 GitHub 后，把下面的 URL 改成你的 GitHub raw 地址
const KARMORA_CONFIG = {
    // GitHub raw 数据源（改成你的仓库）
    DATA_BASE: 'https://raw.githubusercontent.com/JusticAI/karmora-data/main',
    
    // 数据文件路径
    get COMMUNITIES_URL() { return this.DATA_BASE + '/communities-index.json'; },
    get COMMUNITIES_FULL_URL() { return this.DATA_BASE + '/communities.json'; },
    get POSTS_URL() { return this.DATA_BASE + '/posts_by_community.json'; },
    get COMMENTS_URL() { return this.DATA_BASE + '/comments_by_community.json'; },
    get WIKI_URL() { return this.DATA_BASE + '/wiki_guides.json'; },
};

// 全局数据缓存
let _communitiesCache = null;

// 加载社区数据（优先用缓存）
async function loadCommunities() {
    if (_communitiesCache) return _communitiesCache;
    
    try {
        const res = await fetch(KARMORA_CONFIG.COMMUNITIES_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        _communitiesCache = await res.json();
        console.log(`[Karmora] 加载 ${_communitiesCache.length} 个社区`);
        return _communitiesCache;
    } catch (e) {
        console.error('[Karmora] 数据加载失败:', e);
        // 降级：尝试本地 data.js
        if (typeof COMMUNITIES !== 'undefined') {
            console.warn('[Karmora] 使用本地 data.js 降级');
            _communitiesCache = COMMUNITIES;
            return _communitiesCache;
        }
        return [];
    }
}

// 加载完整社区数据（含规则详情）
async function loadCommunityDetail(communityName) {
    try {
        const res = await fetch(KARMORA_CONFIG.COMMUNITIES_FULL_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const all = await res.json();
        return all.find(c => c.name === communityName) || null;
    } catch (e) {
        console.error('[Karmora] 详情加载失败:', e);
        return null;
    }
}
