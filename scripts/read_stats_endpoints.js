/**
 * 读取可能包含 weekly visitors 的端点内容
 * 在 www.reddit.com/r/AskReddit 的 Console 中执行
 */
(async () => {
    const sub = 'AskReddit';
    
    const endpoints = [
        { name: 'about/stats', url: `/r/${sub}/about/stats` },
        { name: 'about/traffic', url: `/r/${sub}/about/traffic` },
        { name: 'svc/subreddit', url: `/svc/subreddit/${sub}` },
        { name: 'about/structured', url: `/r/${sub}/about/structured` },
    ];
    
    for (const ep of endpoints) {
        console.log(`\n━━━ ${ep.name} ━━━`);
        try {
            const resp = await fetch(ep.url, { credentials: 'same-origin' });
            const text = await resp.text();
            
            console.log(`HTTP ${resp.status} | 长度: ${text.length}`);
            
            // 检查是否包含关键词
            const keywords = ['visitor', 'weekly', 'contribution', 'traffic', 'view', 'member'];
            for (const kw of keywords) {
                if (text.toLowerCase().includes(kw)) {
                    const idx = text.toLowerCase().indexOf(kw);
                    const context = text.substring(Math.max(0, idx - 60), idx + 80);
                    console.log(`🎯 包含 "${kw}": ...${context}...`);
                }
            }
            
            // 显示前500字符
            console.log(`内容预览: ${text.substring(0, 500)}`);
            
        } catch (e) {
            console.log(`❌ ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
})();
