/**
 * Reddit 规则采集脚本
 * 使用方法：
 * 1. 在浏览器中打开 https://www.reddit.com/r/ecommerce/ （确保已登录）
 * 2. 按 F12 打开 DevTools → Console
 * 3. 粘贴此脚本并回车执行
 * 4. 脚本会自动复制结果到剪贴板，粘贴给我即可
 */

(async () => {
    const sub = 'ecommerce';
    const result = { subreddit: sub, rules: [], wiki: {}, about: {} };

    // 1. 获取社区元信息
    try {
        const aboutResp = await fetch(`/r/${sub}/about.json`, { credentials: 'same-origin' });
        const aboutData = await aboutResp.json();
        result.about = {
            title: aboutData.data.title,
            description: aboutData.data.public_description,
            subscribers: aboutData.data.subscribers,
            created_utc: aboutData.data.created_utc,
            over18: aboutData.data.over18,
            wiki_enabled: aboutData.data.wiki_enabled,
            submit_text: aboutData.data.submit_text
        };
        console.log('✅ about.json loaded');
    } catch(e) {
        console.log('❌ about.json failed:', e.message);
    }

    // 2. 获取规则
    try {
        const rulesResp = await fetch(`/r/${sub}/rules.json`, { credentials: 'same-origin' });
        const rulesData = await rulesResp.json();
        result.rules = (rulesData.rules || []).map(r => ({
            name: r.short_name,
            description: r.description,
            reason: r.violation_reason,
            kind: r.kind,  // "all" | "link" | "comment"
            priority: r.priority
        }));
        console.log(`✅ rules.json loaded: ${result.rules.length} rules`);
    } catch(e) {
        console.log('❌ rules.json failed:', e.message);
    }

    // 3. 获取 wiki 页面列表
    try {
        const wikiPagesResp = await fetch(`/r/${sub}/wiki/pages.json`, { credentials: 'same-origin' });
        const wikiPagesData = await wikiPagesResp.json();
        const pages = wikiPagesData.data || [];
        console.log(`✅ wiki pages list: ${pages.length} pages found`);

        // 4. 获取关键 wiki 页面内容（最多取前5个，避免请求过多）
        const importantPages = pages.slice(0, 5);
        for (const pageName of importantPages) {
            try {
                const pageResp = await fetch(`/r/${sub}/wiki/${pageName}.json`, { credentials: 'same-origin' });
                const pageData = await pageResp.json();
                result.wiki[pageName] = {
                    content: pageData.data?.content_md || '',
                    length: (pageData.data?.content_md || '').length
                };
                console.log(`  ✅ wiki/${pageName}: ${result.wiki[pageName].length} chars`);
            } catch(e) {
                console.log(`  ❌ wiki/${pageName} failed`);
            }
            await new Promise(r => setTimeout(r, 500)); // 避免频率限制
        }
    } catch(e) {
        console.log('❌ wiki pages failed:', e.message);
    }

    // 5. 复制到剪贴板
    const output = JSON.stringify(result, null, 2);
    copy(output);
    console.log(`\n🎉 Done! ${result.rules.length} rules, ${Object.keys(result.wiki).length} wiki pages`);
    console.log('📋 Data copied to clipboard! Paste it to Karmora.');

    return result;
})();
