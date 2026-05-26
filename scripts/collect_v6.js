/**
 * Reddit 全量社区采集 V6 (防限流版)
 * 
 * 在 old.reddit.com Console 中执行
 * 
 * 优化：
 * - 减少总请求数，增加请求间隔
 * - 分阶段执行，不会一次打太多请求
 * - 优先用社区列表端点（自带详情），帖子端点只提取名字
 * - 补充详情单独分批，可以随时中断继续
 * 
 * 预计耗时：6-10 分钟
 */

(async () => {
    const allCommunities = {};
    let totalFetched = 0;
    let errorCount = 0;
    const startTime = Date.now();

    // ============ 配置 ============
    const CONFIG = {
        // 请求间隔（毫秒）- 调大防限流
        delayShort: 600,
        delayMedium: 1000,
        delayLong: 1500,
        // 各源最大页数
        popularPages: 30,     // r/popular (每页100帖子，30页=3000帖子)
        allPages: 30,         // r/all
        subPopularPages: 30,  // /subreddits/popular (每页100社区)
        subDefaultPages: 5,
        subNewPages: 10,
        // 补充详情：最多搜多少个社区
        enrichMax: 200,
        enrichDelay: 1200,
    };

    // ============ 辅助函数 ============
    async function fetchJSON(url, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                const resp = await fetch(url, { credentials: 'same-origin' });
                if (resp.status === 429) {
                    // 被限流，等久一点再重试
                    console.log(`  ⏳ 被限流，等待 ${(i + 1) * 5} 秒...`);
                    await new Promise(r => setTimeout(r, (i + 1) * 5000));
                    continue;
                }
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

    // 从帖子提取社区名
    function addFromPost(d, source) {
        const name = d.subreddit;
        if (!name || typeof name !== 'string') return null;
        if (!allCommunities[name]) {
            allCommunities[name] = { name, source: [source], subscribers: 0 };
        } else {
            if (!allCommunities[name].source.includes(source))
                allCommunities[name].source.push(source);
        }
        return name;
    }

    // 从社区对象提取
    function addFromSubreddit(d, source) {
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
            // 合并：用详情更丰富的覆盖
            const c = allCommunities[name];
            if (d.subscribers && (!c.subscribers || d.subscribers > c.subscribers)) {
                c.subscribers = d.subscribers;
                c.active_users = d.accounts_active || c.active_users;
                c.title = c.title || d.title || '';
                c.description = c.description || (d.public_description || '').substring(0, 300);
                c.over18 = d.over18 ?? c.over18;
                c.subreddit_type = c.subreddit_type || d.subreddit_type || '';
            }
            if (!c.source.includes(source)) c.source.push(source);
        }
        return name;
    }

    // 分页采集（带进度）
    async function collectPaged(urlFn, addFn, source, maxPages, delayMs) {
        let after = null;
        let page = 0;
        let count = 0;
        let consecutiveErrors = 0;

        while (page < maxPages) {
            const url = urlFn(after);
            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) break;

                for (const child of children) {
                    if (addFn(child.data, source)) count++;
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;
                consecutiveErrors = 0;

                if (!after) break;
                await new Promise(r => setTimeout(r, delayMs));
            } catch (e) {
                errorCount++;
                consecutiveErrors++;
                if (consecutiveErrors >= 3) {
                    console.log(`  🛑 连续3次失败，跳过此源`);
                    break;
                }
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        return count;
    }

    // ============ 阶段1：社区列表端点（自带详情） ============
    console.log('🚀 Reddit 社区采集 V6 (防限流版)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 阶段1：社区列表端点（自带详情信息）\n');

    console.log('📡 [1/3] /subreddits/popular.json');
    const r1 = await collectPaged(
        (after) => `/subreddits/popular.json?limit=100${after ? '&after=' + after : ''}`,
        addFromSubreddit, 'sub_popular', CONFIG.subPopularPages, CONFIG.delayMedium
    );
    console.log(`  ✅ ${r1} 个 | 总计 ${Object.keys(allCommunities).length}\n`);

    console.log('📡 [2/3] /subreddits/default.json');
    const r2 = await collectPaged(
        (after) => `/subreddits/default.json?limit=100${after ? '&after=' + after : ''}`,
        addFromSubreddit, 'sub_default', CONFIG.subDefaultPages, CONFIG.delayMedium
    );
    console.log(`  ✅ ${r2} 个 | 总计 ${Object.keys(allCommunities).length}\n`);

    console.log('📡 [3/3] /subreddits/new.json');
    const r3 = await collectPaged(
        (after) => `/subreddits/new.json?limit=100${after ? '&after=' + after : ''}`,
        addFromSubreddit, 'sub_new', CONFIG.subNewPages, CONFIG.delayMedium
    );
    console.log(`  ✅ ${r3} 个 | 总计 ${Object.keys(allCommunities).length}\n`);

    // ============ 阶段2：帖子端点（只提取社区名） ============
    console.log('📋 阶段2：帖子端点（提取社区名）\n');

    console.log('📡 [4/4] r/popular/hot.json');
    const r4 = await collectPaged(
        (after) => `/r/popular/hot.json?limit=100&raw_json=1${after ? '&after=' + after : ''}`,
        addFromPost, 'r_popular', CONFIG.popularPages, CONFIG.delayShort
    );
    console.log(`  ✅ ${r4} 个 | 总计 ${Object.keys(allCommunities).length}\n`);

    console.log('📡 [5/5] r/all/hot.json');
    const r5 = await collectPaged(
        (after) => `/r/all/hot.json?limit=100&raw_json=1${after ? '&after=' + after : ''}`,
        addFromPost, 'r_all', CONFIG.allPages, CONFIG.delayShort
    );
    console.log(`  ✅ ${r5} 个 | 总计 ${Object.keys(allCommunities).length}\n`);

    // ============ 阶段3：补充详情（可选，限流保护） ============
    const needDetail = Object.keys(allCommunities).filter(n => !allCommunities[n].subscribers);
    console.log(`📋 阶段3：补充详情 (${needDetail.length} 个社区缺少信息)\n`);

    let enriched = 0;
    let enrichErrors = 0;
    const maxEnrich = Math.min(needDetail.length, CONFIG.enrichMax);

    for (let i = 0; i < maxEnrich; i++) {
        const name = needDetail[i];
        try {
            const data = await fetchJSON(`/subreddits/search.json?q=${encodeURIComponent(name)}&limit=5&sort=relevance`);
            const match = (data.data?.children || []).find(
                c => c.data.display_name?.toLowerCase() === name.toLowerCase()
            );
            if (match) {
                const d = match.data;
                const c = allCommunities[name];
                c.subscribers = d.subscribers || 0;
                c.active_users = d.accounts_active || 0;
                c.description = (d.public_description || '').substring(0, 300);
                c.title = d.title || '';
                c.over18 = d.over18 ?? false;
                c.subreddit_type = d.subreddit_type || '';
                enriched++;
            }
        } catch {
            enrichErrors++;
            if (enrichErrors >= 5) {
                console.log(`  ⚠️ 补充详情连续失败，提前结束`);
                break;
            }
        }

        if (i % 20 === 0 && i > 0) {
            console.log(`  📊 进度: ${i}/${maxEnrich}, 已补充 ${enriched}`);
        }
        await new Promise(r => setTimeout(r, CONFIG.enrichDelay));
    }
    console.log(`  ✅ 补充完成: ${enriched}/${maxEnrich}\n`);

    // ============ 后处理 & 下载 ============
    const communities = Object.values(allCommunities);
    communities.forEach(c => { c.source = [...new Set(c.source)]; });
    communities.sort((a, b) => b.subscribers - a.subscribers);

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    const output = {
        meta: {
            collected_at: new Date().toISOString(),
            elapsed_minutes: parseFloat(elapsed),
            total_fetched: totalFetched,
            unique_count: communities.length,
            errors: errorCount,
            enriched,
            results: { sub_popular: r1, sub_default: r2, sub_new: r3, r_popular: r4, r_all: r5 }
        },
        communities
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `reddit_communities_v6_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);

    // ============ 报告 ============
    console.log('\n🎉 采集完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 去重后: ${communities.length} 个社区`);
    console.log(`⏱️  耗时: ${elapsed} 分钟`);
    console.log(`❌ 错误: ${errorCount} 次`);
    console.log(`📝 补充详情: ${enriched} 个`);

    console.log('\n📈 各源:');
    console.log(`  ${r1 > 0 ? '✅' : '❌'} sub/popular: ${r1}`);
    console.log(`  ${r2 > 0 ? '✅' : '❌'} sub/default: ${r2}`);
    console.log(`  ${r3 > 0 ? '✅' : '❌'} sub/new: ${r3}`);
    console.log(`  ${r4 > 0 ? '✅' : '❌'} r/popular: ${r4}`);
    console.log(`  ${r5 > 0 ? '✅' : '❌'} r/all: ${r5}`);

    const tiers = [['>1M', 1e6], ['100K-1M', 1e5], ['10K-100K', 1e4], ['1K-10K', 1e3], ['<1K', 0]];
    console.log('\n📊 订阅量:');
    for (let i = 0; i < tiers.length; i++) {
        const [l, min] = tiers[i];
        const max = i > 0 ? tiers[i - 1][1] : Infinity;
        console.log(`  ${l}: ${communities.filter(c => c.subscribers >= min && c.subscribers < max).length}`);
    }
})();
