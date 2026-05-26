/**
 * Reddit 全量社区采集 V3 (old.reddit.com 专用)
 * 
 * ⚠️ 必须在 old.reddit.com 上执行！
 * 1. 打开 https://old.reddit.com/ 并登录
 * 2. F12 → Console → 粘贴本脚本
 * 
 * 5个采集源，全部用 old.reddit.com：
 * 1. /r/popular/hot.json — 热门帖子中的社区
 * 2. /r/all/hot.json — 全站帖子中的社区
 * 3. /subreddits/popular.json — 热门社区列表
 * 4. /subreddits/default.json — 默认社区
 * 5. /subreddits/new.json — 新社区
 * 
 * 预计耗时：5-8 分钟
 */

(async () => {
    const BASE = 'https://old.reddit.com';
    const allCommunities = {};
    let totalFetched = 0;
    let errorCount = 0;
    const startTime = Date.now();

    // ============ 辅助函数 ============
    async function fetchJSON(path, retries = 3) {
        const url = path.startsWith('http') ? path : BASE + path;
        for (let i = 0; i < retries; i++) {
            try {
                const resp = await fetch(url, { credentials: 'same-origin' });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const text = await resp.text();
                try {
                    return JSON.parse(text);
                } catch {
                    throw new Error('Invalid JSON (可能被拦截或返回HTML)');
                }
            } catch (e) {
                if (i === retries - 1) throw e;
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }

    function addCommunity(d, source) {
        const name = d.display_name;
        if (!name) return null;
        if (!allCommunities[name]) {
            allCommunities[name] = {
                name: name,
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
            if (!allCommunities[name].source.includes(source)) {
                allCommunities[name].source.push(source);
            }
        }
        return name;
    }

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // 通用分页采集器
    async function collectPaged(urlFn, source, maxPages, delayMs = 500) {
        let after = null;
        let page = 0;
        let count = 0;

        while (page < maxPages) {
            let url = urlFn(after);
            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) break;

                for (const child of children) {
                    const name = addCommunity(child.data, source);
                    if (name) count++;
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;
                console.log(`  📄 第${page}页: +${children.length}, 本源${count}个, 总计${Object.keys(allCommunities).length}个`);

                if (!after) break;
                await delay(delayMs);
            } catch (e) {
                console.log(`  ❌ 第${page + 1}页出错: ${e.message}`);
                errorCount++;
                break;
            }
        }

        return count;
    }

    // ============ 5个采集源 ============
    console.log('🚀 Reddit 全量社区采集 V3 (old.reddit.com)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 方案1: r/popular 热帖
    console.log('📡 [1/5] r/popular/hot.json');
    const r1 = await collectPaged(
        (after) => `/r/popular/hot.json?limit=100&raw_json=1${after ? '&after=' + after : ''}`,
        'r_popular', 50, 400
    );
    console.log(`  ✅ 完成: ${r1} 个社区\n`);

    // 方案2: r/all 热帖
    console.log('📡 [2/5] r/all/hot.json');
    const r2 = await collectPaged(
        (after) => `/r/all/hot.json?limit=100&raw_json=1${after ? '&after=' + after : ''}`,
        'r_all', 50, 400
    );
    console.log(`  ✅ 完成: ${r2} 个社区\n`);

    // 方案3: subreddits/popular
    console.log('📡 [3/5] /subreddits/popular.json');
    const r3 = await collectPaged(
        (after) => `/subreddits/popular.json?limit=100${after ? '&after=' + after : ''}`,
        'subreddits_popular', 25, 500
    );
    console.log(`  ✅ 完成: ${r3} 个社区\n`);

    // 方案4: subreddits/default
    console.log('📡 [4/5] /subreddits/default.json');
    const r4 = await collectPaged(
        (after) => `/subreddits/default.json?limit=100${after ? '&after=' + after : ''}`,
        'subreddits_default', 5, 500
    );
    console.log(`  ✅ 完成: ${r4} 个社区\n`);

    // 方案5: subreddits/new
    console.log('📡 [5/5] /subreddits/new.json');
    const r5 = await collectPaged(
        (after) => `/subreddits/new.json?limit=100${after ? '&after=' + after : ''}`,
        'subreddits_new', 10, 500
    );
    console.log(`  ✅ 完成: ${r5} 个社区\n`);

    // ============ 后处理 ============
    const communities = Object.values(allCommunities);
    communities.forEach(c => { c.source = [...new Set(c.source)]; });
    communities.sort((a, b) => b.subscribers - a.subscribers);

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    // 自动下载
    const output = {
        meta: {
            collected_at: new Date().toISOString(),
            elapsed_minutes: parseFloat(elapsed),
            total_fetched: totalFetched,
            unique_count: communities.length,
            errors: errorCount,
            results: { r_popular: r1, r_all: r2, subreddits_popular: r3, subreddits_default: r4, subreddits_new: r5 }
        },
        communities: communities
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `reddit_communities_v3_${new Date().toISOString().slice(0, 10)}.json`;
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

    console.log('\n📈 各方案结果:');
    console.log(`  ${r1 > 0 ? '✅' : '❌'} r/popular: ${r1} 个`);
    console.log(`  ${r2 > 0 ? '✅' : '❌'} r/all: ${r2} 个`);
    console.log(`  ${r3 > 0 ? '✅' : '❌'} subreddits/popular: ${r3} 个`);
    console.log(`  ${r4 > 0 ? '✅' : '❌'} subreddits/default: ${r4} 个`);
    console.log(`  ${r5 > 0 ? '✅' : '❌'} subreddits/new: ${r5} 个`);

    // 来源统计
    const srcStats = {};
    communities.forEach(c => c.source.forEach(s => { srcStats[s] = (srcStats[s] || 0) + 1; }));
    console.log('\n📊 来源分布:');
    Object.entries(srcStats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v} 个`));

    // 订阅量分布
    const tiers = [['>1M', 1000000], ['100K-1M', 100000], ['10K-100K', 10000], ['1K-10K', 1000], ['<1K', 0]];
    console.log('\n📊 订阅量分布:');
    for (let i = 0; i < tiers.length; i++) {
        const [label, min] = tiers[i];
        const max = i > 0 ? tiers[i - 1][1] : Infinity;
        const count = communities.filter(c => c.subscribers >= min && c.subscribers < max).length;
        console.log(`  ${label}: ${count} 个`);
    }
})();
