/**
 * Reddit 全量社区采集 V4 (纯搜索方案)
 * 
 * 只用 /subreddits/search.json 这个已验证可用的端点
 * 扩大搜索词覆盖面：26字母 + 常见前缀 + 热门话题词
 * 
 * 在 www.reddit.com 或 old.reddit.com 的 Console 中执行
 * 预计耗时：8-15 分钟
 */

(async () => {
    const BASE = location.origin;
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

    function addCommunity(d, query) {
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
                found_via: [query]
            };
        } else {
            if (!allCommunities[name].found_via.includes(query)) {
                allCommunities[name].found_via.push(query);
            }
        }
        return name;
    }

    // 单个搜索词采集（最多 maxPages 页）
    async function searchQuery(query, maxPages = 10, delayMs = 800) {
        let after = null;
        let page = 0;
        let count = 0;

        while (page < maxPages) {
            let url = `${BASE}/subreddits/search.json?q=${encodeURIComponent(query)}&limit=100&sort=relevance`;
            if (after) url += `&after=${after}`;

            try {
                const data = await fetchJSON(url);
                const children = data.data?.children || [];
                if (children.length === 0) break;

                for (const child of children) {
                    const name = addCommunity(child.data, query);
                    if (name) count++;
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;

                if (!after) break;
                await new Promise(r => setTimeout(r, delayMs));
            } catch (e) {
                errorCount++;
                break;
            }
        }

        return count;
    }

    // ============ 搜索词列表 ============

    // 26个字母
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

    // 常见社区前缀
    const prefixes = [
        'r/', 'ask', 'true', 'real', 'the', 'my', 'best', 'top',
        'old', 'new', 'big', 'small', 'good', 'bad', 'fun', 'cool',
        'dark', 'light', 'hot', 'wild', 'free', 'open', 'public',
        'random', 'daily', 'weekly', 'mega', 'super', 'ultra'
    ];

    // 热门话题/领域（英文）
    const topics = [
        // 游戏
        'gaming', 'game', 'minecraft', 'fortnite', 'valorant', 'league', 'steam',
        'nintendo', 'xbox', 'playstation', 'pc', 'fps', 'rpg', 'mmo',
        // 科技
        'programming', 'python', 'javascript', 'react', 'web', 'app', 'ai',
        'machine learning', 'data', 'linux', 'windows', 'apple', 'android',
        'crypto', 'bitcoin', 'blockchain', 'tech', 'software', 'hardware',
        // 娱乐
        'movie', 'music', 'anime', 'manga', 'netflix', 'youtube', 'tiktok',
        'book', 'podcast', 'stream', 'tv', 'film', 'celebrity',
        // 生活
        'food', 'cook', 'recipe', 'fitness', 'gym', 'health', 'travel',
        'pet', 'dog', 'cat', 'plant', 'garden', 'home', 'diy', 'craft',
        'fashion', 'style', 'makeup', 'skincare',
        // 学习
        'learn', 'study', 'school', 'college', 'university', 'language',
        'math', 'science', 'history', 'philosophy', 'psychology',
        // 商业
        'business', 'entrepreneur', 'startup', 'invest', 'stock', 'market',
        'real estate', 'job', 'career', 'freelance', 'money', 'finance',
        // 社交/讨论
        'ask', 'question', 'advice', 'help', 'tip', 'guide', 'review',
        'opinion', 'debate', 'discuss', 'story', 'confession', 'rant',
        // 创意
        'art', 'draw', 'paint', 'photo', 'design', 'creative', 'write',
        'poem', 'story', 'pixel', '3d', 'animation',
        // 地理/地区
        'usa', 'uk', 'canada', 'australia', 'europe', 'asia', 'india',
        'china', 'japan', 'korea', 'germany', 'france', 'brazil', 'mexico',
        // Reddit 特色
        'reddit', 'mod', 'subreddit', 'karma', 'ama', 'eli5', 'til',
        'lpt', 'ysk', 'dadjokes', 'memes', 'shitpost', 'cringe',
        // NSFW 安全替代
        'hot', 'beautiful', 'cute', 'pretty', 'gorgeous', 'amazing',
        // 其他热门
        'relationship', 'dating', 'wedding', 'baby', 'parent', 'family',
        'car', 'motor', 'bike', 'sport', 'football', 'soccer', 'basketball',
        'nba', 'nfl', 'f1', 'tennis', 'golf', 'boxing', 'mma',
        'space', 'nasa', 'science', 'physics', 'biology', 'chemistry',
        'environment', 'climate', 'nature', 'animal', 'wildlife',
        'news', 'world', 'politics', 'election', 'law', 'legal',
        'military', 'veteran', 'fire', 'police', 'ems',
    ];

    // 常见子串（覆盖更多社区名模式）
    const substrings = [
        'irl', 'irls', 'peoples', 'people', 'twitter', 'facebook',
        'tumblr', 'discord', 'youtube', 'instagram', 'pinterest',
        'satisfying', 'oddly', 'unexpected', 'nextlevel', 'interesting',
        'insane', 'crazy', 'wtf', 'facepalm', 'therewasanattempt',
        'nononono', 'yesyesyes', 'maybemaybemaybe',
        'wholesome', 'heartwarming', 'made', 'smile',
        'shitty', 'crappy', 'awesome', 'excellent', 'perfect',
        'nostalgia', 'oldschool', 'retro', 'vintage', 'classic',
        'metal', 'rock', 'punk', 'hiphop', 'rap', 'jazz', 'classical',
        'gaming', 'gamers', 'gamer', 'player', 'players',
    ];

    // ============ 主流程 ============
    const allQueries = [...letters, ...prefixes, ...topics, ...substrings];
    // 去重
    const uniqueQueries = [...new Set(allQueries)];

    console.log('🚀 Reddit 全量社区采集 V4 (纯搜索方案)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 搜索词: ${uniqueQueries.length} 个`);
    console.log(`⏱️  预计耗时: ${Math.ceil(uniqueQueries.length * 1.8 / 60)} 分钟\n`);

    let queryIndex = 0;
    for (const query of uniqueQueries) {
        queryIndex++;
        const count = await searchQuery(query, 8, 800);
        const total = Object.keys(allCommunities).length;

        if (queryIndex % 10 === 0 || count > 5) {
            console.log(`[${queryIndex}/${uniqueQueries.length}] "${query}" → +${count}, 总计 ${total}`);
        }

        // 搜索词间间隔
        await new Promise(r => setTimeout(r, 500));
    }

    // ============ 后处理 ============
    const communities = Object.values(allCommunities);
    communities.forEach(c => { c.found_via = [...new Set(c.found_via)]; });
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
            queries_used: uniqueQueries.length
        },
        communities: communities
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `reddit_communities_v4_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);

    // 报告
    console.log('\n\n🎉 采集完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 总拉取: ${totalFetched} 条`);
    console.log(`📊 去重后: ${communities.length} 个社区`);
    console.log(`⏱️  耗时: ${elapsed} 分钟`);
    console.log(`❌ 错误: ${errorCount} 次`);

    // 订阅量分布
    const tiers = [['>1M', 1000000], ['100K-1M', 100000], ['10K-100K', 10000], ['1K-10K', 1000], ['<1K', 0]];
    console.log('\n📊 订阅量分布:');
    for (let i = 0; i < tiers.length; i++) {
        const [label, min] = tiers[i];
        const max = i > 0 ? tiers[i - 1][1] : Infinity;
        const count = communities.filter(c => c.subscribers >= min && c.subscribers < max).length;
        console.log(`  ${label}: ${count} 个`);
    }

    // Top 10
    console.log('\n🏆 Top 10:');
    communities.slice(0, 10).forEach((c, i) => {
        console.log(`  ${i + 1}. r/${c.name} (${c.subscribers.toLocaleString()} 订阅)`);
    });
})();
