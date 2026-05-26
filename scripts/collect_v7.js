/**
 * Reddit 全量社区采集 V7 (完整版)
 * 
 * 在 old.reddit.com Console 中执行
 * 
 * 限流策略：100请求/400秒，每批90个，监控 remaining 头动态等待
 * 不跳过任何失败，全部重试到底
 * 
 * 预计耗时：30-50 分钟（取决于需要补充多少社区详情）
 */

(async () => {
    // ============ 配置 ============
    const BATCH_LIMIT = 90;           // 每批最多请求数（留10余量）
    const REQUEST_INTERVAL = 4000;    // 请求间隔 4 秒
    const RESUME_THRESHOLD = 15;      // remaining 低于此值时等待重置
    const MAX_RETRIES = 5;            // 单个请求最大重试次数
    const ENRICH_MAX = 500;           // 最多补充多少个社区详情

    // ============ 状态 ============
    const allCommunities = {};
    let totalRequests = 0;
    let batchUsed = 0;
    let errorCount = 0;
    const startTime = Date.now();

    // ============ 核心请求函数 ============
    async function fetchJSON(url, retries = MAX_RETRIES) {
        for (let i = 0; i < retries; i++) {
            try {
                const resp = await fetch(url, { credentials: 'same-origin' });
                totalRequests++;
                batchUsed++;

                // 读取限流头
                const remaining = parseFloat(resp.headers.get('x-ratelimit-remaining') || '999');
                const reset = parseFloat(resp.headers.get('x-ratelimit-reset') || '0');
                const used = parseFloat(resp.headers.get('x-ratelimit-used') || '0');

                // 动态等待：如果剩余配额不足，等到重置
                if (remaining < RESUME_THRESHOLD && reset > 0) {
                    const waitMs = (reset + 5) * 1000; // 多等5秒buffer
                    console.log(`  ⏳ 剩余 ${remaining}，等待 ${Math.ceil(waitMs / 1000)} 秒后继续...`);
                    await new Promise(r => setTimeout(r, waitMs));
                    batchUsed = 0; // 重置批次计数
                }

                if (resp.status === 429) {
                    const retryAfter = parseInt(resp.headers.get('retry-after') || '60');
                    console.log(`  ⏳ HTTP 429，等待 ${retryAfter} 秒...`);
                    await new Promise(r => setTimeout(r, (retryAfter + 5) * 1000));
                    batchUsed = 0;
                    continue;
                }

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                const text = await resp.text();
                try { return JSON.parse(text); }
                catch { throw new Error('Invalid JSON'); }

            } catch (e) {
                if (i === retries - 1) throw e;
                const wait = Math.min(5000 * (i + 1), 30000);
                console.log(`  ⚠️ 重试 ${i + 1}/${retries}: ${e.message}，等 ${wait / 1000} 秒`);
                await new Promise(r => setTimeout(r, wait));
            }
        }
    }

    // ============ 数据添加函数 ============
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
            const c = allCommunities[name];
            if (d.subscribers && (!c.subscribers || d.subscribers > c.subscribers)) {
                c.subscribers = d.subscribers;
                c.active_users = d.accounts_active || c.active_users;
                c.description = c.description || (d.public_description || '').substring(0, 300);
                c.title = c.title || d.title || '';
                c.over18 = d.over18 ?? c.over18;
                c.subreddit_type = c.subreddit_type || d.subreddit_type || '';
            }
            if (!c.source.includes(source)) c.source.push(source);
        }
        return name;
    }

    // ============ 分页采集 ============
    async function collectPaged(urlFn, addFn, source, maxPages) {
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
                    if (addFn(child.data, source)) count++;
                }

                after = data.data?.after;
                page++;
                if (!after) break;

                await new Promise(r => setTimeout(r, REQUEST_INTERVAL));
            } catch (e) {
                console.log(`  ❌ 第${page + 1}页: ${e.message}`);
                errorCount++;
                // 不跳过，等一下继续
                await new Promise(r => setTimeout(r, 10000));
                continue;
            }
        }

        return count;
    }

    // ============ 阶段1：社区列表端点 ============
    console.log('🚀 Reddit 社区采集 V7 (完整版)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`限流: 100请求/400秒, 每批${BATCH_LIMIT}个, 间隔${REQUEST_INTERVAL / 1000}秒\n`);

    console.log('📡 [阶段1] 社区列表端点 (自带详情)\n');

    console.log('  [1/5] /subreddits/popular.json');
    const r1 = await collectPaged(
        (after) => `/subreddits/popular.json?limit=100${after ? '&after=' + after : ''}`,
        addFromSubreddit, 'sub_popular', 30
    );
    console.log(`  ✅ ${r1} 个 | 总计 ${Object.keys(allCommunities).length} | 已用 ${totalRequests} 请求\n`);

    console.log('  [2/5] /subreddits/default.json');
    const r2 = await collectPaged(
        (after) => `/subreddits/default.json?limit=100${after ? '&after=' + after : ''}`,
        addFromSubreddit, 'sub_default', 5
    );
    console.log(`  ✅ ${r2} 个 | 总计 ${Object.keys(allCommunities).length} | 已用 ${totalRequests} 请求\n`);

    console.log('  [3/5] /subreddits/new.json');
    const r3 = await collectPaged(
        (after) => `/subreddits/new.json?limit=100${after ? '&after=' + after : ''}`,
        addFromSubreddit, 'sub_new', 10
    );
    console.log(`  ✅ ${r3} 个 | 总计 ${Object.keys(allCommunities).length} | 已用 ${totalRequests} 请求\n`);

    // ============ 阶段2：帖子端点 ============
    console.log('📡 [阶段2] 帖子端点 (提取社区名)\n');

    console.log('  [4/5] r/popular/hot.json');
    const r4 = await collectPaged(
        (after) => `/r/popular/hot.json?limit=100&raw_json=1${after ? '&after=' + after : ''}`,
        addFromPost, 'r_popular', 30
    );
    console.log(`  ✅ ${r4} 个 | 总计 ${Object.keys(allCommunities).length} | 已用 ${totalRequests} 请求\n`);

    console.log('  [5/5] r/all/hot.json');
    const r5 = await collectPaged(
        (after) => `/r/all/hot.json?limit=100&raw_json=1${after ? '&after=' + after : ''}`,
        addFromPost, 'r_all', 30
    );
    console.log(`  ✅ ${r5} 个 | 总计 ${Object.keys(allCommunities).length} | 已用 ${totalRequests} 请求\n`);

    // ============ 阶段3：补充详情 ============
    const needDetail = Object.keys(allCommunities)
        .filter(n => !allCommunities[n].subscribers)
        // 按出现次数排序（多源出现的更重要）
        .sort((a, b) => allCommunities[b].source.length - allCommunities[a].source.length);

    const enrichCount = Math.min(needDetail.length, ENRICH_MAX);
    console.log(`📡 [阶段3] 补充详情`);
    console.log(`  缺少详情: ${needDetail.length} 个 | 本次补充: ${enrichCount} 个\n`);

    let enriched = 0;
    for (let i = 0; i < enrichCount; i++) {
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
        } catch (e) {
            // 不跳过，记个日志继续
            console.log(`  ⚠️ "${name}" 失败: ${e.message}`);
            errorCount++;
        }

        if (i % 20 === 0 && i > 0) {
            console.log(`  📊 进度: ${i}/${enrichCount} | 已补充 ${enriched} | 总请求 ${totalRequests}`);
        }

        await new Promise(r => setTimeout(r, REQUEST_INTERVAL));
    }
    console.log(`  ✅ 补充完成: ${enriched}/${enrichCount}\n`);

    // ============ 后处理 & 下载 ============
    const communities = Object.values(allCommunities);
    communities.forEach(c => { c.source = [...new Set(c.source)]; });
    communities.sort((a, b) => b.subscribers - a.subscribers);

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    const output = {
        meta: {
            collected_at: new Date().toISOString(),
            elapsed_minutes: parseFloat(elapsed),
            total_requests: totalRequests,
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
    a.download = `reddit_communities_v7_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);

    // ============ 报告 ============
    console.log('\n🎉 采集完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 社区总数: ${communities.length}`);
    console.log(`📡 总请求数: ${totalRequests}`);
    console.log(`⏱️  总耗时: ${elapsed} 分钟`);
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
