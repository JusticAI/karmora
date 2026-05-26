/**
 * Reddit 全量社区采集脚本 V2
 * 
 * 在 Reddit 已登录页面的 Console 中执行
 * 三路采集：r/popular + r/all + 26字母搜索
 * 预计耗时：8-12 分钟
 * 
 * 使用方法：
 * 1. 打开 https://www.reddit.com/ 并确保已登录
 * 2. F12 打开 DevTools → Console
 * 3. 粘贴本脚本并回车执行
 * 4. 等待完成，文件自动下载
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
                return await resp.json();
            } catch (e) {
                if (i === retries - 1) throw e;
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }

    function addCommunity(d) {
        const name = d.display_name;
        if (!name) return;
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
                lang: d.lang || '',
                source: []  // 记录数据来源
            };
        }
        return name;
    }

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // ============ 采集方式1：r/popular 热帖提取社区 ============
    async function collectFromPopular() {
        console.log('\n📡 [1/3] 采集 r/popular 热帖中的社区...');
        let after = null;
        let page = 0;
        const maxPages = 50;  // 最多50页，每页100条 = 5000帖子
        let count = 0;

        while (page < maxPages) {
            let url = `https://www.reddit.com/r/popular/hot.json?limit=100&raw_json=1`;
            if (after) url += `&after=${after}`;

            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) break;

                for (const child of children) {
                    const name = addCommunity(child.data);
                    if (name) {
                        allCommunities[name].source.push('popular');
                        count++;
                    }
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;
                process.stdout.write(`\r  📄 r/popular: 第${page}页, 本源${count}个社区, 总计${Object.keys(allCommunities).length}个`);

                if (!after) break;
                await delay(350);
            } catch (e) {
                console.log(`\n  ❌ r/popular 第${page + 1}页出错: ${e.message}`);
                errorCount++;
                break;
            }
        }

        console.log(`\n  ✅ r/popular 完成: ${count} 个社区`);
    }

    // ============ 采集方式2：r/all 热帖提取社区 ============
    async function collectFromAll() {
        console.log('\n📡 [2/3] 采集 r/all 热帖中的社区...');
        let after = null;
        let page = 0;
        const maxPages = 50;
        let count = 0;

        while (page < maxPages) {
            let url = `https://www.reddit.com/r/all/hot.json?limit=100&raw_json=1`;
            if (after) url += `&after=${after}`;

            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) break;

                for (const child of children) {
                    const name = addCommunity(child.data);
                    if (name) {
                        allCommunities[name].source.push('all');
                        count++;
                    }
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;
                process.stdout.write(`\r  📄 r/all: 第${page}页, 本源${count}个社区, 总计${Object.keys(allCommunities).length}个`);

                if (!after) break;
                await delay(350);
            } catch (e) {
                console.log(`\n  ❌ r/all 第${page + 1}页出错: ${e.message}`);
                errorCount++;
                break;
            }
        }

        console.log(`\n  ✅ r/all 完成: ${count} 个社区`);
    }

    // ============ 采集方式3：26字母搜索 ============
    async function collectFromSearch() {
        console.log('\n📡 [3/3] 26字母搜索社区...');
        const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
        let searchCount = 0;

        for (const letter of letters) {
            let after = null;
            let page = 0;
            const maxPages = 10;  // 每个字母最多10页

            while (page < maxPages) {
                let url = `/subreddits/search.json?q=${encodeURIComponent(letter)}&limit=100&sort=relevance`;
                if (after) url += `&after=${after}`;

                try {
                    const data = await fetchJSON(url);
                    const children = data.data?.children || [];
                    if (children.length === 0) break;

                    for (const child of children) {
                        const name = addCommunity(child.data);
                        if (name) {
                            allCommunities[name].source.push('search:' + letter);
                            searchCount++;
                        }
                    }

                    after = data.data?.after;
                    page++;
                    totalFetched += children.length;

                    if (!after) break;
                    await delay(800);  // 搜索接口限流更严
                } catch (e) {
                    errorCount++;
                    break;
                }
            }

            const total = Object.keys(allCommunities).length;
            console.log(`  🔤 "${letter}" 完成, 累计 ${total} 个社区`);
            await delay(500);
        }

        console.log(`  ✅ 字母搜索完成: ${searchCount} 个社区`);
    }

    // ============ 主流程 ============
    console.log('🚀 Reddit 全量社区采集 V2');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('三路采集：r/popular + r/all + 26字母搜索\n');

    await collectFromPopular();
    await collectFromAll();
    await collectFromSearch();

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
            methods: ['popular', 'all', '26-letter-search']
        },
        communities: communities
    };

    // 自动下载 JSON
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reddit_all_communities_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // ============ 统计报告 ============
    console.log('\n\n🎉 采集完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 总拉取: ${totalFetched} 条`);
    console.log(`📊 去重后: ${communities.length} 个社区`);
    console.log(`⏱️  耗时: ${elapsed} 分钟`);
    console.log(`❌ 错误: ${errorCount} 次`);
    console.log(`📁 文件已自动下载`);

    // 来源统计
    const sourceStats = { popular: 0, all: 0, search: 0 };
    communities.forEach(c => {
        if (c.source.some(s => s === 'popular')) sourceStats.popular++;
        if (c.source.some(s => s === 'all')) sourceStats.all++;
        if (c.source.some(s => s.startsWith('search'))) sourceStats.search++;
    });
    console.log(`\n📈 来源分布:`);
    console.log(`  r/popular: ${sourceStats.popular} 个社区`);
    console.log(`  r/all:     ${sourceStats.all} 个社区`);
    console.log(`  字母搜索:  ${sourceStats.search} 个社区`);

    // 订阅量分布
    const tiers = [
        { label: '>1M', min: 1000000 },
        { label: '100K-1M', min: 100000 },
        { label: '10K-100K', min: 10000 },
        { label: '1K-10K', min: 1000 },
        { label: '<1K', min: 0 }
    ];
    console.log(`\n📊 订阅量分布:`);
    for (const tier of tiers) {
        const count = communities.filter(c => c.subscribers >= tier.min && (tier === tiers[0] || c.subscribers < tiers[tiers.indexOf(tier) - 1]?.min)).length;
        console.log(`  ${tier.label}: ${count} 个`);
    }
})();
