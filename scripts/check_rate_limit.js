/**
 * 诊断脚本 - 读取 Reddit 真实限流信息
 * 在 old.reddit.com Console 中执行
 * 连发 5 个请求，读取响应头中的限流字段
 */
(async () => {
    console.log('🔍 检测 Reddit 真实限流配置...\n');

    const endpoints = [
        { name: '字母搜索', url: '/subreddits/search.json?q=test&limit=1' },
        { name: 'sub/popular', url: '/subreddits/popular.json?limit=1' },
        { name: 'r/popular/hot', url: '/r/popular/hot.json?limit=1&raw_json=1' },
        { name: 'r/all/hot', url: '/r/all/hot.json?limit=1&raw_json=1' },
    ];

    for (const ep of endpoints) {
        try {
            const resp = await fetch(ep.url, { credentials: 'same-origin' });
            const headers = {};
            resp.headers.forEach((val, key) => {
                headers[key] = val;
            });

            console.log(`📡 ${ep.name}:`);
            console.log(`   HTTP ${resp.status}`);

            // Reddit 限流相关头
            const rlFields = [
                'x-ratelimit-used',
                'x-ratelimit-remaining',
                'x-ratelimit-reset',
                'retry-after',
                'x-ratelimit-limit',
            ];
            for (const f of rlFields) {
                const val = resp.headers.get(f);
                if (val !== null) {
                    console.log(`   ${f}: ${val}`);
                }
            }

            // 打印所有非标准头
            const stdHeaders = ['content-type', 'content-length', 'date', 'connection', 'vary', 'cache-control', 'x-frame-options', 'x-content-type-options', 'x-xss-protection', 'strict-transport-security'];
            const customHeaders = [];
            resp.headers.forEach((val, key) => {
                if (!stdHeaders.includes(key.toLowerCase()) && !rlFields.includes(key.toLowerCase())) {
                    customHeaders.push(`   ${key}: ${val}`);
                }
            });
            if (customHeaders.length > 0) {
                console.log('   其他头:');
                customHeaders.forEach(h => console.log(h));
            }

            console.log('');
        } catch (e) {
            console.log(`❌ ${ep.name}: ${e.message}\n`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    // 快速连发测试：看多少请求后被限
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 快速连发测试 (间隔200ms, 发20个请求)...\n');

    let blocked = false;
    for (let i = 1; i <= 20; i++) {
        try {
            const resp = await fetch('/subreddits/search.json?q=test' + i + '&limit=1', { credentials: 'same-origin' });
            const remaining = resp.headers.get('x-ratelimit-remaining');
            const used = resp.headers.get('x-ratelimit-used');
            const reset = resp.headers.get('x-ratelimit-reset');
            const status = resp.status;

            if (status === 429) {
                console.log(`  ❌ #${i}: HTTP 429 (被限流!) | remaining=${remaining} | retry-after=${resp.headers.get('retry-after')}`);
                blocked = true;
                break;
            } else {
                console.log(`  ✅ #${i}: HTTP ${status} | used=${used} remaining=${remaining} reset=${reset}`);
            }
        } catch (e) {
            console.log(`  ❌ #${i}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 200));
    }

    if (!blocked) {
        console.log('\n✅ 20个请求全部成功，限流比较宽松');
    } else {
        console.log('\n⚠️ 在第N个请求被限流了');
    }
})();
