/**
 * Reddit 社区采集 - 修复版 (r/popular + r/all 补采)
 * 
 * 在 Reddit 已登录页面的 Console 中执行
 * 专门补采之前失败的 r/popular 和 r/all 数据
 * 
 * 三个替代方案：
 * 1. /subreddits/popular.json — 直接获取热门社区列表
 * 2. old.reddit.com/r/popular/hot.json — 用旧版 Reddit
 * 3. /r/popular.json — 尝试不带 hot 路径
 * 
 * 预计耗时：3-5 分钟
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
                try {
                    return JSON.parse(text);
                } catch {
                    throw new Error('Invalid JSON response');
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
            allCommunities[name].source.push(source);
        }
        return name;
    }

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // ============ 方案1：/subreddits/popular.json ============
    async function collectSubredditsPopular() {
        console.log('\n📡 [方案1] /subreddits/popular.json (热门社区列表)');
        let after = null;
        let page = 0;
        const maxPages = 25;  // 每页100, 25页 = 2500个社区
        let count = 0;

        while (page < maxPages) {
            let url = `/subreddits/popular.json?limit=100`;
            if (after) url += `&after=${after}`;

            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) {
                    console.log(`\n  📭 第${page + 1}页无数据，停止`);
                    break;
                }

                for (const child of children) {
                    const name = addCommunity(child.data, 'subreddits_popular');
                    if (name) count++;
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;
                console.log(`  📄 第${page}页: +${children.length} 条, 本源${count}个, 总计${Object.keys(allCommunities).length}个`);

                if (!after) {
                    console.log('  📄 已到最后一页');
                    break;
                }
                await delay(500);
            } catch (e) {
                console.log(`  ❌ 第${page + 1}页出错: ${e.message}`);
                errorCount++;
                break;
            }
        }

        console.log(`  ✅ 方案1完成: ${count} 个社区`);
        return count;
    }

    // ============ 方案2：old.reddit.com/r/popular/hot.json ============
    async function collectOldRedditPopular() {
        console.log('\n📡 [方案2] old.reddit.com/r/popular/hot.json');
        let after = null;
        let page = 0;
        const maxPages = 25;
        let count = 0;

        while (page < maxPages) {
            let url = `https://old.reddit.com/r/popular/hot.json?limit=100&raw_json=1`;
            if (after) url += `&after=${after}`;

            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) break;

                for (const child of children) {
                    const name = addCommunity(child.data, 'old_popular');
                    if (name) count++;
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;
                console.log(`  📄 第${page}页: +${children.length} 条, 本源${count}个, 总计${Object.keys(allCommunities).length}个`);

                if (!after) break;
                await delay(500);
            } catch (e) {
                console.log(`  ❌ 第${page + 1}页出错: ${e.message}`);
                errorCount++;
                break;
            }
        }

        console.log(`  ✅ 方案2完成: ${count} 个社区`);
        return count;
    }

    // ============ 方案3：old.reddit.com/r/all/hot.json ============
    async function collectOldRedditAll() {
        console.log('\n📡 [方案3] old.reddit.com/r/all/hot.json');
        let after = null;
        let page = 0;
        const maxPages = 25;
        let count = 0;

        while (page < maxPages) {
            let url = `https://old.reddit.com/r/all/hot.json?limit=100&raw_json=1`;
            if (after) url += `&after=${after}`;

            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) break;

                for (const child of children) {
                    const name = addCommunity(child.data, 'old_all');
                    if (name) count++;
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;
                console.log(`  📄 第${page}页: +${children.length} 条, 本源${count}个, 总计${Object.keys(allCommunities).length}个`);

                if (!after) break;
                await delay(500);
            } catch (e) {
                console.log(`  ❌ 第${page + 1}页出错: ${e.message}`);
                errorCount++;
                break;
            }
        }

        console.log(`  ✅ 方案3完成: ${count} 个社区`);
        return count;
    }

    // ============ 方案4：/subreddits/default.json ============
    async function collectSubredditsDefault() {
        console.log('\n📡 [方案4] /subreddits/default.json (默认社区)');
        let after = null;
        let page = 0;
        const maxPages = 5;
        let count = 0;

        while (page < maxPages) {
            let url = `/subreddits/default.json?limit=100`;
            if (after) url += `&after=${after}`;

            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) break;

                for (const child of children) {
                    const name = addCommunity(child.data, 'subreddits_default');
                    if (name) count++;
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;

                if (!after) break;
                await delay(500);
            } catch (e) {
                console.log(`  ❌ 第${page + 1}页出错: ${e.message}`);
                errorCount++;
                break;
            }
        }

        console.log(`  ✅ 方案4完成: ${count} 个社区`);
        return count;
    }

    // ============ 方案5：/subreddits/new.json (新社区) ============
    async function collectSubredditsNew() {
        console.log('\n📡 [方案5] /subreddits/new.json (新社区)');
        let after = null;
        let page = 0;
        const maxPages = 10;
        let count = 0;

        while (page < maxPages) {
            let url = `/subreddits/new.json?limit=100`;
            if (after) url += `&after=${after}`;

            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) break;

                for (const child of children) {
                    const name = addCommunity(child.data, 'subreddits_new');
                    if (name) count++;
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;

                if (!after) break;
                await delay(500);
            } catch (e) {
                console.log(`  ❌ 第${page + 1}页出错: ${e.message}`);
                errorCount++;
                break;
            }
        }

        console.log(`  ✅ 方案5完成: ${count} 个社区`);
        return count;
    }

    // ============ 主流程 ============
    console.log('🚀 Reddit 社区补采脚本');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('5个替代方案：subreddits/popular + old.reddit popular + old.reddit all + subreddits/default + subreddits/new\n');

    const results = {};
    results.subreddits_popular = await collectSubredditsPopular();
    results.old_popular = await collectOldRedditPopular();
    results.old_all = await collectOldRedditAll();
    results.subreddits_default = await collectSubredditsDefault();
    results.subreddits_new = await collectSubredditsNew();

    // ============ 后处理 ============
    const communities = Object.values(allCommunities);

    // 去重 source 标签
    communities.forEach(c => {
        c.source = [...new Set(c.source)];
    });

    // 按 subscribers 排序
    communities.sort((a, b) => b.subscribers - a.subscribers);

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    const output = {
        meta: {
            collected_at: new Date().toISOString(),
            elapsed_minutes: parseFloat(elapsed),
            total_fetched: totalFetched,
            unique_count: communities.length,
            errors: errorCount,
            methods: Object.keys(results)
        },
        communities: communities
    };

    // 自动下载 JSON
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reddit_communities_supplement_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // ============ 统计报告 ============
    console.log('\n\n🎉 补采完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 总拉取: ${totalFetched} 条`);
    console.log(`📊 去重后: ${communities.length} 个社区`);
    console.log(`⏱️  耗时: ${elapsed} 分钟`);
    console.log(`❌ 错误: ${errorCount} 次`);

    console.log('\n📈 各方案结果:');
    for (const [method, count] of Object.entries(results)) {
        const status = count > 0 ? '✅' : '❌';
        console.log(`  ${status} ${method}: ${count} 个社区`);
    }

    // 订阅量分布
    const tiers = [
        { label: '>1M', min: 1000000 },
        { label: '100K-1M', min: 100000 },
        { label: '10K-100K', min: 10000 },
        { label: '1K-10K', min: 1000 },
        { label: '<1K', min: 0 }
    ];
    console.log(`\n📊 订阅量分布:`);
    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const nextMin = i > 0 ? tiers[i - 1].min : Infinity;
        const count = communities.filter(c => c.subscribers >= tier.min && c.subscribers < nextMin).length;
        console.log(`  ${tier.label}: ${count} 个`);
    }
})();
