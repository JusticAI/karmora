/**
 * Reddit 全量社区采集脚本
 * 
 * 在 Reddit 任意页面的 Console 中执行
 * 采集完成后自动下载 JSON 文件
 * 
 * 预计耗时：26个字母 × 10页 × 1.2秒/页 ≈ 5分钟
 */
(async () => {
    const allCommunities = {};
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    let totalFetched = 0;

    console.log('🚀 开始全量采集，共 26 个字母...');

    for (const letter of letters) {
        let after = null;
        let page = 0;
        const maxPages = 10;

        while (page < maxPages) {
            let url = `/subreddits/search.json?q=${encodeURIComponent(letter)}&limit=100&sort=relevance`;
            if (after) url += `&after=${after}`;

            try {
                const resp = await fetch(url, { credentials: 'same-origin' });
                const data = await resp.json();
                const children = data.data?.children || [];

                if (children.length === 0) break;

                for (const child of children) {
                    const d = child.data;
                    const name = d.display_name;
                    if (!allCommunities[name]) {
                        allCommunities[name] = {
                            name: name,
                            title: d.title || '',
                            description: (d.public_description || '').substring(0, 300),
                            subscribers: d.subscribers || 0,
                            active_users: d.accounts_active || 0,
                            over18: d.over18 || false,
                            created_utc: d.created_utc || 0
                        };
                    }
                }

                after = data.data?.after;
                page++;
                totalFetched += children.length;

                if (!after) break;
                await new Promise(r => setTimeout(r, 1200));
            } catch (e) {
                console.log(`  ❌ ${letter} 第${page + 1}页出错: ${e.message}`);
                break;
            }
        }

        const count = Object.keys(allCommunities).length;
        console.log(`✅ "${letter}" 完成，累计去重 ${count} 个社区`);
        await new Promise(r => setTimeout(r, 800));
    }

    // 转为数组并按 subscribers 排序
    const result = Object.values(allCommunities).sort((a, b) => b.subscribers - a.subscribers);

    // 构建输出
    const output = {
        meta: {
            collected_at: new Date().toISOString(),
            total_fetched: totalFetched,
            unique_count: result.length
        },
        communities: result
    };

    // 自动下载 JSON 文件
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reddit_communities_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`\n🎉 采集完成!`);
    console.log(`📊 总共拉取: ${totalFetched} 条`);
    console.log(`📊 去重后: ${result.length} 个社区`);
    console.log(`📁 文件已自动下载`);
})();
