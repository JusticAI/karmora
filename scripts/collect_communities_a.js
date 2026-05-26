/**
 * Reddit 社区采集 - 搜索字母 A
 * 在 Reddit 任意页面的 Console 中执行
 */
(async () => {
    const letter = 'A';
    const allCommunities = [];
    let after = null;
    let page = 0;
    const maxPages = 10; // 最多拉10页，每页25条

    console.log(`🔍 开始搜索字母 "${letter}" 的社区...`);

    while (page < maxPages) {
        let url = `/subreddits/search.json?q=${letter}&limit=100&sort=relevance`;
        if (after) url += `&after=${after}`;

        try {
            const resp = await fetch(url, { credentials: 'same-origin' });
            const data = await resp.json();
            const children = data.data?.children || [];

            if (children.length === 0) {
                console.log(`📭 第 ${page + 1} 页无数据，停止`);
                break;
            }

            for (const child of children) {
                const d = child.data;
                allCommunities.push({
                    name: d.display_name,
                    title: d.title,
                    description: d.public_description?.substring(0, 200) || '',
                    subscribers: d.subscribers || 0,
                    active_users: d.accounts_active || 0,
                    over18: d.over18,
                    created_utc: d.created_utc
                });
            }

            after = data.data?.after;
            page++;
            console.log(`✅ 第 ${page} 页: ${children.length} 条，累计 ${allCommunities.length}`);

            if (!after) {
                console.log('📄 已到最后一页');
                break;
            }

            await new Promise(r => setTimeout(r, 1200)); // 避免限流
        } catch (e) {
            console.log(`❌ 第 ${page + 1} 页出错: ${e.message}`);
            break;
        }
    }

    // 去重
    const unique = {};
    allCommunities.forEach(c => {
        if (!unique[c.name]) {
            unique[c.name] = c;
        }
    });
    const result = Object.values(unique);

    // 输出
    const output = JSON.stringify({
        letter: letter,
        total_fetched: allCommunities.length,
        unique_count: result.length,
        communities: result
    }, null, 2);

    // 显示在页面上
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;bottom:10px;z-index:99999;background:white;border:3px solid #ff4500;border-radius:12px;padding:20px;overflow:auto;font-family:monospace;font-size:12px;';
    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <b style="color:#ff4500;font-size:16px;">📋 字母 "${letter}" — ${result.length} 个社区</b>
            <button id="copyBtn" style="padding:8px 16px;background:#ff4500;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">复制数据</button>
        </div>
        <pre id="jsonData" style="white-space:pre-wrap;background:#f5f5f5;padding:10px;border-radius:6px;max-height:80vh;overflow:auto;">${output}</pre>
    `;
    document.body.appendChild(container);
    document.getElementById('copyBtn').onclick = () => {
        navigator.clipboard.writeText(output).then(() => {
            document.getElementById('copyBtn').textContent = '✅ 已复制!';
        }).catch(() => alert('请按 Ctrl+C'));
    };

    console.log(`\n🎉 完成! 共 ${allCommunities.length} 条，去重后 ${result.length} 个社区`);
})();
