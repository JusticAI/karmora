/**
 * Reddit 规则采集脚本 v2
 * 在 Reddit 页面的 Console 中执行
 * 会自动显示结果在页面上，点击"复制数据"即可
 */
(async () => {
    const sub = 'Entrepreneur';
    const result = { subreddit: sub, rules: [], wiki: {}, about: {} };

    try {
        const aboutResp = await fetch(`/r/${sub}/about.json`, { credentials: 'same-origin' });
        const aboutData = await aboutResp.json();
        result.about = {
            title: aboutData.data.title,
            description: aboutData.data.public_description,
            subscribers: aboutData.data.subscribers,
            wiki_enabled: aboutData.data.wiki_enabled,
            submit_text: aboutData.data.submit_text
        };
        console.log('✅ about loaded');
    } catch(e) {
        console.log('❌ about:', e.message);
    }

    try {
        const rulesResp = await fetch(`/r/${sub}/rules.json`, { credentials: 'same-origin' });
        const rulesData = await rulesResp.json();
        result.rules = (rulesData.rules || []).map(r => ({
            name: r.short_name,
            description: r.description,
            reason: r.violation_reason,
            kind: r.kind
        }));
        console.log(`✅ rules: ${result.rules.length}`);
    } catch(e) {
        console.log('❌ rules:', e.message);
    }

    try {
        const wikiPagesResp = await fetch(`/r/${sub}/wiki/pages.json`, { credentials: 'same-origin' });
        const wikiPagesData = await wikiPagesResp.json();
        const pages = wikiPagesData.data || [];
        console.log(`✅ wiki pages: ${pages.length}`);
        for (const pageName of pages.slice(0, 5)) {
            try {
                const pageResp = await fetch(`/r/${sub}/wiki/${pageName}.json`, { credentials: 'same-origin' });
                const pageData = await pageResp.json();
                result.wiki[pageName] = {
                    content: (pageData.data?.content_md || '').substring(0, 3000),
                    length: (pageData.data?.content_md || '').length
                };
                console.log(`  ✅ wiki/${pageName}: ${result.wiki[pageName].length} chars`);
            } catch(e) {
                console.log(`  ❌ wiki/${pageName}`);
            }
            await new Promise(r => setTimeout(r, 500));
        }
    } catch(e) {
        console.log('❌ wiki:', e.message);
    }

    const output = JSON.stringify(result, null, 2);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;bottom:10px;z-index:99999;background:white;border:3px solid #ff4500;border-radius:12px;padding:20px;overflow:auto;font-family:monospace;font-size:12px;';
    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <b style="color:#ff4500;font-size:16px;">📋 Reddit Rules Data — r/${sub}</b>
            <button id="copyBtn" style="padding:8px 16px;background:#ff4500;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">复制数据</button>
        </div>
        <div style="margin-bottom:10px;color:#666;">
            Rules: ${result.rules.length} | Wiki: ${Object.keys(result.wiki).length} | Subscribers: ${result.about.subscribers || 'N/A'}
        </div>
        <pre id="jsonData" style="white-space:pre-wrap;word-break:break-all;background:#f5f5f5;padding:10px;border-radius:6px;">${output}</pre>
    `;
    document.body.appendChild(container);
    document.getElementById('copyBtn').onclick = () => {
        navigator.clipboard.writeText(output).then(() => {
            document.getElementById('copyBtn').textContent = '✅ 已复制!';
            setTimeout(() => document.getElementById('copyBtn').textContent = '复制数据', 2000);
        }).catch(() => {
            const range = document.createRange();
            range.selectNode(document.getElementById('jsonData'));
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            alert('请按 Ctrl+C 手动复制');
        });
    };
    console.log(`🎉 Done! ${result.rules.length} rules`);
})();
