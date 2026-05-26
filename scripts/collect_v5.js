/**
 * Reddit 全量社区采集 V5 (修复版)
 * 
 * 在 old.reddit.com Console 中执行
 * 
 * 修复内容：
 * - r/popular, r/all 返回的是帖子，用 d.subreddit 提取社区名
 * - subreddits/* 返回的是社区，用 d.display_name
 * - 全部用相对 URL，避免跨域问题
 * 
 * 预计耗时：8-12 分钟
 */

(async () => {
    const allCommunities = {};
    let totalFetched = 0;
    let errorCount = 0;
    const startTime = Date.now();

    // ============ 辅助函数 ============
    async function fetchJSON(url, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const resp = await fetch(url, { credentials: 'same-origin' });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const text = await resp.text();
                try { return JSON.parse(text); }
                catch { throw new Error('Invalid JSON'); }
            } catch (e) {
                if (i === retries - 1) throw e;
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }

    // 从帖子数据中提取社区名（r/popular, r/all 用）
    function addCommunityFromPost(d, source) {
        const name = d.subreddit;  // 帖子的社区名在这个字段
        if (!name || typeof name !== 'string') return null;
        // subreddit 字段返回的是不含 r/ 前缀的名字
        if (!allCommunities[name]) {
            allCommunities[name] = {
                name,
                title: '',
                description: '',
                subscribers: 0,
                active_users: 0,
                over18: d.over_18 || false,
                created_utc: 0,
                source: [source]
            };
        } else {
            if (!allCommunities[name].source.includes(source)) {
                allCommunities[name].source.push(source);
            }
        }
        return name;
    }

    // 从社区数据中提取（subreddits/* 端点用）
    function addCommunityFromSubreddit(d, source) {
        const name = d.display_name;
        if (!name) return null;
        if (!allCommunities[name]) {
            allCommunities[name] = {
                name,
                title: d.title || '',
                description: (d.public_description || '').substring(0, 300),
                subscribers: d.subscribers || 0,
                active_users: d.accounts_active || 0,
                over18: d.over18 || false,
                created_utc: d.created_utc || 0,
                subreddit_type: d.subreddit_type || '',
                source: [source]
            };
        } else {
            // 更新空字段
            const c = allCommunities[name];
            if (!c.subscribers && d.subscribers) c.subscribers = d.subscribers;
            if (!c.description && d.public_description) c.description = d.public_description.substring(0, 300);
            if (!c.source.includes(source)) c.source.push(source);
        }
        return name;
    }

    // 通用分页采集
    async function collectPaged(urlFn, addFn, source, maxPages, delayMs = 400) {
        let after = null;
        let page = 0;
        let count = 0;

        while (page < maxPages) {
            const url = urlFn(after);
            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) break;

                for (const child of children) {
                    const name = addFn(child.data, source);
                    if (name) count++;
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;

                if (!after) break;
                await new Promise(r => setTimeout(r, delayMs));
            } catch (e) {
                console.log(`  ❌ 第${page + 1}页: ${e.message}`);
                errorCount++;
                break;
            }
        }

        return count;
    }

    // ============ 主流程 ============
    console.log('🚀 Reddit 全量社区采集 V5');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // --- 源1: r/popular 热帖 → 提取社区名 ---
    console.log('📡 [1/5] r/popular/hot.json (从帖子提取社区)');
    const r1 = await collectPaged(
        (after) => `/r/popular/hot.json?limit=100&raw_json=1${after ? '&after=' + after : ''}`,
        addCommunityFromPost, 'r_popular', 50, 400
    );
    console.log(`  ✅ r/popular: ${r1} 个社区, 总计 ${Object.keys(allCommunities).length}\n`);

    // --- 源2: r/all 热帖 → 提取社区名 ---
    console.log('📡 [2/5] r/all/hot.json (从帖子提取社区)');
    const r2 = await collectPaged(
        (after) => `/r/all/hot.json?limit=100&raw_json=1${after ? '&after=' + after : ''}`,
        addCommunityFromPost, 'r_all', 50, 400
    );
    console.log(`  ✅ r/all: ${r2} 个社区, 总计 ${Object.keys(allCommunities).length}\n`);

    // --- 源3: subreddits/popular → 直接社区列表 ---
    console.log('📡 [3/5] /subreddits/popular.json');
    const r3 = await collectPaged(
        (after) => `/subreddits/popular.json?limit=100${after ? '&after=' + after : ''}`,
        addCommunityFromSubreddit, 'subreddits_popular', 50, 500
    );
    console.log(`  ✅ subreddits/popular: ${r3} 个社区, 总计 ${Object.keys(allCommunities).length}\n`);

    // --- 源4: subreddits/default ---
    console.log('📡 [4/5] /subreddits/default.json');
    const r4 = await collectPaged(
        (after) => `/subreddits/default.json?limit=100${after ? '&after=' + after : ''}`,
        addCommunityFromSubreddit, 'subreddits_default', 10, 500
    );
    console.log(`  ✅ subreddits/default: ${r4} 个社区, 总计 ${Object.keys(allCommunities).length}\n`);

    // --- 源5: subreddits/new ---
    console.log('📡 [5/5] /subreddits/new.json');
    const r5 = await collectPaged(
        (after) => `/subreddits/new.json?limit=100${after ? '&after=' + after : ''}`,
        addCommunityFromSubreddit, 'subreddits_new', 20, 500
    );
    console.log(`  ✅ subreddits/new: ${r5} 个社区, 总计 ${Object.keys(allCommunities).length}\n`);

    // ============ 补充：用搜索端点填充缺失的详细信息 ============
    console.log('📡 [补充] 用搜索端点补充社区详情...');
    const names = Object.keys(allCommunities);
    let enriched = 0;

    // 对没有详情的社区，用搜索补充
    const needDetail = names.filter(n => !allCommunities[n].subscribers);
    console.log(`  需要补充详情: ${needDetail.length} 个\n`);

    // 批量搜索（每批用社区名的前几个字符搜索）
    for (let i = 0; i < needDetail.length && i < 500; i++) {
        const name = needDetail[i];
        try {
            const data = await fetchJSON(`/subreddits/search.json?q=${encodeURIComponent(name)}&limit=5&sort=relevance`);
            const children = data.data?.children || [];
            // 精确匹配
            const match = children.find(c => c.data.display_name?.toLowerCase() === name.toLowerCase());
            if (match) {
                const d = match.data;
                const c = allCommunities[name];
                c.subscribers = d.subscribers || c.subscribers;
                c.active_users = d.accounts_active || c.active_users;
                c.description = (d.public_description || '').substring(0, 300) || c.description;
                c.title = d.title || c.title;
                enriched++;
            }
        } catch {}

        if (i % 50 === 0 && i > 0) {
            console.log(`  进度: ${i}/${needDetail.length}, 已补充 ${enriched} 个`);
        }
        await new Promise(r => setTimeout(r, 800));
    }
    console.log(`  ✅ 补充完成: ${enriched} 个社区获得详情\n`);

    // ============ 后处理 ============
    const communities = Object.values(allCommunities);
    communities.forEach(c => { c.source = [...new Set(c.source)]; });
    communities.sort((a, b) => b.subscribers - a.subscribers);

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    // 下载
    const output = {
        meta: {
            collected_at: new Date().toISOString(),
            elapsed_minutes: parseFloat(elapsed),
            total_fetched: totalFetched,
            unique_count: communities.length,
            errors: errorCount,
            results: { r_popular: r1, r_all: r2, subreddits_popular: r3, subreddits_default: r4, subreddits_new: r5, enriched }
        },
        communities: communities
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `reddit_communities_v5_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);

    // ============ 报告 ============
    console.log('\n🎉 采集完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 总拉取: ${totalFetched} 条`);
    console.log(`📊 去重后: ${communities.length} 个社区`);
    console.log(`⏱️  耗时: ${elapsed} 分钟`);
    console.log(`❌ 错误: ${errorCount} 次`);
    console.log(`📝 补充详情: ${enriched} 个`);

    console.log('\n📈 各源结果:');
    console.log(`  ${r1 > 0 ? '✅' : '❌'} r/popular: ${r1}`);
    console.log(`  ${r2 > 0 ? '✅' : '❌'} r/all: ${r2}`);
    console.log(`  ${r3 > 0 ? '✅' : '❌'} subreddits/popular: ${r3}`);
    console.log(`  ${r4 > 0 ? '✅' : '❌'} subreddits/default: ${r4}`);
    console.log(`  ${r5 > 0 ? '✅' : '❌'} subreddits/new: ${r5}`);

    const tiers = [['>1M', 1000000], ['100K-1M', 100000], ['10K-100K', 10000], ['1K-10K', 1000], ['<1K', 0]];
    console.log('\n📊 订阅量分布:');
    for (let i = 0; i < tiers.length; i++) {
        const [label, min] = tiers[i];
        const max = i > 0 ? tiers[i - 1][1] : Infinity;
        const count = communities.filter(c => c.subscribers >= min && c.subscribers < max).length;
        console.log(`  ${label}: ${count}`);
    }

    console.log('\n🏆 Top 10:');
    communities.slice(0, 10).forEach((c, i) => {
        console.log(`  ${i + 1}. r/${c.name} (${c.subscribers.toLocaleString()}) via [${c.source.join(',')}]`);
    });
})();
