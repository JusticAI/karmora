/**
 * 诊断脚本 - 测试各个 Reddit API 端点
 * 在 old.reddit.com 的 Console 中执行
 * 只测试，不采集，几秒就出结果
 */
(async () => {
    const tests = [
        { name: '字母搜索 (已知可用)', url: '/subreddits/search.json?q=a&limit=5' },
        { name: 'r/popular/hot.json', url: '/r/popular/hot.json?limit=5&raw_json=1' },
        { name: 'r/all/hot.json', url: '/r/all/hot.json?limit=5&raw_json=1' },
        { name: '/subreddits/popular.json', url: '/subreddits/popular.json?limit=5' },
        { name: '/subreddits/default.json', url: '/subreddits/default.json?limit=5' },
        { name: '/subreddits/new.json', url: '/subreddits/new.json?limit=5' },
        { name: 'r/popular.json (无hot)', url: '/r/popular.json?limit=5&raw_json=1' },
    ];

    for (const t of tests) {
        try {
            const resp = await fetch(t.url, { credentials: 'same-origin' });
            const status = resp.status;
            const text = await resp.text();
            let result;
            try {
                result = JSON.parse(text);
                const children = result.data?.children || [];
                const first = children[0]?.data?.display_name || 'N/A';
                console.log(`✅ ${t.name}: HTTP ${status}, ${children.length}条, 首个: ${first}`);
            } catch {
                console.log(`❌ ${t.name}: HTTP ${status}, 非JSON响应 (${text.substring(0, 80)}...)`);
            }
        } catch (e) {
            console.log(`❌ ${t.name}: 请求失败 - ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }
})();
