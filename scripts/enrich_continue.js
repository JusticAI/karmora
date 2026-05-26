/**
 * Reddit 社区详情补充脚本 (接续 V7)
 * 
 * 在 old.reddit.com Console 中执行
 * 读取已有的 v7 数据，补充剩余缺少详情的社区
 * 
 * 预计耗时：~70 分钟（1044 个 × 4 秒/请求）
 */

(async () => {
    // ============ 配置 ============
    const REQUEST_INTERVAL = 4000;
    const RESUME_THRESHOLD = 15;
    const MAX_RETRIES = 5;

    // ============ 加载已有数据 ============
    // 需要先在 Console 中加载 JSON 文件内容
    // 方法：打开 v7 的 JSON 文件，复制内容，粘贴到变量
    let existingData;
    try {
        // 尝试从剪贴板读取
        const text = await navigator.clipboard.readText();
        existingData = JSON.parse(text);
        console.log('📋 从剪贴板加载数据成功');
    } catch {
        console.log('⚠️ 无法从剪贴板读取');
        console.log('请按以下步骤操作：');
        console.log('1. 用文本编辑器打开下载的 reddit_communities_v7_*.json');
        console.log('2. 全选复制');
        console.log('3. 在 Console 中输入: window._v7data = [粘贴到这里]');
        console.log('4. 然后重新运行本脚本');
        
        if (window._v7data) {
            existingData = window._v7data;
            console.log('✅ 从 window._v7data 加载数据');
        } else {
            return;
        }
    }

    const communities = existingData.communities;
    const needEnrich = communities.filter(c => !c.subscribers || c.subscribers === 0);
    
    console.log(`📊 已有社区: ${communities.length} 个`);
    console.log(`📊 需要补充: ${needEnrich.length} 个`);
    console.log(`⏱️  预计耗时: ${Math.ceil(needEnrich.length * 4 / 60)} 分钟\n`);

    // ============ 请求函数 ============
    let totalRequests = 0;
    let errorCount = 0;
    const startTime = Date.now();

    async function fetchJSON(url, retries = MAX_RETRIES) {
        for (let i = 0; i < retries; i++) {
            try {
                const resp = await fetch(url, { credentials: 'same-origin' });
                totalRequests++;

                const remaining = parseFloat(resp.headers.get('x-ratelimit-remaining') || '999');
                const reset = parseFloat(resp.headers.get('x-ratelimit-reset') || '0');

                if (remaining < RESUME_THRESHOLD && reset > 0) {
                    const waitMs = (reset + 5) * 1000;
                    console.log(`  ⏳ 剩余 ${remaining}，等待 ${Math.ceil(waitMs / 1000)} 秒...`);
                    await new Promise(r => setTimeout(r, waitMs));
                }

                if (resp.status === 429) {
                    const retryAfter = parseInt(resp.headers.get('retry-after') || '60');
                    console.log(`  ⏳ HTTP 429，等待 ${retryAfter} 秒...`);
                    await new Promise(r => setTimeout(r, (retryAfter + 5) * 1000));
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

    // ============ 补充详情 ============
    console.log('🚀 开始补充详情...\n');

    // 建立索引，方便更新
    const communityMap = {};
    communities.forEach(c => { communityMap[c.name] = c; });

    let enriched = 0;
    let notFound = 0;
    let failed = 0;

    for (let i = 0; i < needEnrich.length; i++) {
        const name = needEnrich[i].name;
        
        try {
            const data = await fetchJSON(`/subreddits/search.json?q=${encodeURIComponent(name)}&limit=5&sort=relevance`);
            const children = data.data?.children || [];
            
            // 精确匹配（大小写不敏感）
            const match = children.find(c => 
                c.data.display_name?.toLowerCase() === name.toLowerCase()
            );

            if (match) {
                const d = match.data;
                const c = communityMap[name];
                c.subscribers = d.subscribers || 0;
                c.active_users = d.accounts_active || 0;
                c.description = (d.public_description || '').substring(0, 300);
                c.title = d.title || '';
                c.over18 = d.over18 ?? false;
                c.subreddit_type = d.subreddit_type || '';
                enriched++;
            } else {
                notFound++;
                // 标记为找不到，避免下次再搜
                communityMap[name].subscribers = -1;
            }

        } catch (e) {
            failed++;
            console.log(`  ❌ "${name}": ${e.message}`);
            errorCount++;
        }

        // 进度报告
        if ((i + 1) % 20 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
            const remaining = needEnrich.length - (i + 1);
            const eta = Math.ceil(remaining * 4 / 60);
            console.log(`  📊 ${i + 1}/${needEnrich.length} | ✅${enriched} ❌${notFound} ⚠️${failed} | 已用${elapsed}分 | 剩余约${eta}分`);
        }

        await new Promise(r => setTimeout(r, REQUEST_INTERVAL));
    }

    // ============ 后处理 ============
    // 把 subscribers=-1 的改回 0（表示确认不存在或私有）
    communities.forEach(c => {
        if (c.subscribers === -1) c.subscribers = 0;
    });

    // 重新排序
    communities.sort((a, b) => b.subscribers - a.subscribers);

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    // 下载更新后的数据
    const output = {
        meta: {
            ...existingData.meta,
            updated_at: new Date().toISOString(),
            enrichment_requests: totalRequests,
            enrichment_errors: errorCount,
            enriched,
            not_found: notFound,
            failed
        },
        communities
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `reddit_communities_v7_enriched_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);

    // ============ 报告 ============
    const hasDetail = communities.filter(c => c.subscribers > 0).length;
    const noDetail = communities.filter(c => c.subscribers === 0).length;

    console.log('\n🎉 补充完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 社区总数: ${communities.length}`);
    console.log(`✅ 有详情: ${hasDetail} (${(hasDetail/communities.length*100).toFixed(1)}%)`);
    console.log(`❌ 仍缺详情: ${noDetail}`);
    console.log(`📝 本次补充: ${enriched}`);
    console.log(`🔍 未找到: ${notFound}`);
    console.log(`⚠️ 失败: ${failed}`);
    console.log(`📡 总请求: ${totalRequests}`);
    console.log(`⏱️  耗时: ${elapsed} 分钟`);
})();
