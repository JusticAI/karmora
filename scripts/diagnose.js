/**
 * 诊断脚本 - 精确查看每个端点返回什么
 * 在 old.reddit.com Console 中执行
 * 只测 7 个请求，几秒出结果
 */
(async () => {
    const tests = [
        ['字母搜索 (已知可用)', '/subreddits/search.json?q=a&limit=3'],
        ['r/popular hot', '/r/popular/hot.json?limit=3&raw_json=1'],
        ['r/all hot', '/r/all/hot.json?limit=3&raw_json=1'],
        ['subreddits/popular', '/subreddits/popular.json?limit=3'],
        ['subreddits/default', '/subreddits/default.json?limit=3'],
        ['subreddits/new', '/subreddits/new.json?limit=3'],
        ['r/popular.json', '/r/popular.json?limit=3&raw_json=1'],
    ];

    for (const [name, url] of tests) {
        try {
            const resp = await fetch(url, { credentials: 'same-origin' });
            const status = resp.status;
            const contentType = resp.headers.get('content-type') || '';
            const text = await resp.text();
            const preview = text.substring(0, 200);

            let parsed = null;
            let children = 0;
            let first = '';
            try {
                parsed = JSON.parse(text);
                children = parsed.data?.children?.length || 0;
                first = parsed.data?.children?.[0]?.data?.display_name || '';
            } catch {}

            const icon = (status === 200 && children > 0) ? '✅' : '❌';
            console.log(`${icon} ${name}`);
            console.log(`   HTTP ${status} | type: ${contentType}`);
            console.log(`   children: ${children} | 首个: ${first || 'N/A'}`);
            if (!parsed) console.log(`   响应: ${preview}`);
            console.log('');
        } catch (e) {
            console.log(`❌ ${name} → 请求异常: ${e.message}\n`);
        }
        await new Promise(r => setTimeout(r, 500));
    }
})();
