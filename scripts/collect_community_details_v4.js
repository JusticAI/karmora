/**
 * Reddit 社区详情采集脚本 - 阶段1 (v4 剪贴板版)
 * 
 * 在 www.reddit.com 的 Console 中执行
 * 
 * 步骤：
 * 1. 复制 reddit_communities_v7_enriched_*.json 的内容
 * 2. 在 Console 中粘贴本脚本并回车
 * 3. 脚本会自动从剪贴板读取数据并开始采集
 * 
 * 预计耗时：~12 小时
 */

(async () => {
    const CONFIG = {
        REQUEST_INTERVAL: 4000,
        RESUME_THRESHOLD: 15,
        MAX_RETRIES: 5,
        SAVE_INTERVAL: 50,
        STORAGE_KEY: 'karmora_details_progress',
    };

    // ============ 从剪贴板加载 ============
    console.log('📋 尝试从剪贴板读取社区数据...');
    
    let communities = [];
    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        communities = data.communities || data;
        console.log(`✅ 读取成功: ${communities.length} 个社区\n`);
    } catch (e) {
        console.log('❌ 无法读取剪贴板');
        console.log('');
        console.log('请按以下步骤操作：');
        console.log('1. 用文本编辑器打开 reddit_communities_v7_enriched_2026-04-30.json');
        console.log('2. 全选 → 复制');
        console.log('3. 回到这里，重新运行本脚本');
        console.log('');
        console.log('注意：浏览器需要剪贴板权限，Chrome 会弹出权限请求，点"允许"');
        return;
    }

    // ============ 恢复进度 ============
    let completed = {};
    let errors = [];
    let totalRequests = 0;

    try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            completed = parsed.completed || {};
            errors = parsed.errors || [];
            totalRequests = parsed.totalRequests || 0;
            console.log(`📂 恢复进度: 已完成 ${Object.keys(completed).length} 个社区\n`);
        }
    } catch {}

    const pending = communities.filter(c => !completed[c.name]);
    console.log(`📊 待采集: ${pending.length} 个\n`);

    if (pending.length === 0) {
        console.log('✅ 全部已完成！');
        return;
    }

    // ============ 请求函数 ============
    async function fetchJSON(url) {
        for (let i = 0; i < CONFIG.MAX_RETRIES; i++) {
            try {
                const resp = await fetch(url, { credentials: 'same-origin' });
                totalRequests++;

                const remaining = parseFloat(resp.headers.get('x-ratelimit-remaining') || '999');
                const reset = parseFloat(resp.headers.get('x-ratelimit-reset') || '0');

                if (remaining < CONFIG.RESUME_THRESHOLD && reset > 0) {
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
                if (i === CONFIG.MAX_RETRIES - 1) throw e;
                await new Promise(r => setTimeout(r, Math.min(5000 * (i + 1), 30000)));
            }
        }
    }

    // ============ 采集单个社区 ============
    async function collectCommunity(name) {
        const result = { name, about: null, rules: null, collected_at: new Date().toISOString() };

        try {
            const data = await fetchJSON(`/r/${name}/about.json`);
            const d = data.data;
            result.about = {
                name: d.display_name,
                title: d.title || '',
                public_description: d.public_description || '',
                description: d.description || '',
                subscribers: d.subscribers || 0,
                active_users: d.accounts_active || 0,
                created_utc: d.created_utc || 0,
                over18: d.over18 || false,
                subreddit_type: d.subreddit_type || 'public',
                lang: d.lang || 'en',
                icon_img: d.icon_img || '',
                banner_img: d.banner_img || '',
                community_icon: d.community_icon || '',
                url: d.url || '',
            };
        } catch (e) {
            result.about_error = e.message;
        }

        await new Promise(r => setTimeout(r, CONFIG.REQUEST_INTERVAL));

        try {
            const data = await fetchJSON(`/r/${name}/about/rules.json`);
            result.rules = (data.rules || []).map(r => ({
                short_name: r.short_name || '',
                description: r.description || '',
                violation_reason: r.violation_reason || '',
                priority: r.priority || 0,
            }));
        } catch (e) {
            result.rules_error = e.message;
        }

        return result;
    }

    // ============ 保存 & 下载 ============
    function save() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ completed, errors, totalRequests }));
        } catch {}
    }

    function download() {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const output = {
            meta: {
                collected_at: new Date().toISOString(),
                elapsed_minutes: parseFloat(elapsed),
                total_requests: totalRequests,
                total_communities: Object.keys(completed).length,
                errors: errors.length,
            },
            communities: Object.values(completed)
        };
        const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reddit_community_details_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============ 主循环 ============
    const startTime = Date.now();

    console.log('🚀 开始采集 (阶段1: about + rules)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('每 4 秒一个请求 | 每 50 个社区自动保存');
    console.log('按 Esc → 点红色 ■ 可随时停止\n');

    for (let i = 0; i < pending.length; i++) {
        const name = pending[i].name;

        try {
            const result = await collectCommunity(name);
            completed[name] = result;
            if (result.about_error || result.rules_error) {
                errors.push({ name, about_error: result.about_error, rules_error: result.rules_error });
            }
        } catch (e) {
            errors.push({ name, error: e.message });
        }

        const done = Object.keys(completed).length;
        const total = communities.length;
        if ((i + 1) % 10 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
            const eta = ((total - done) * 4 / 60).toFixed(0);
            console.log(`  📊 ${done}/${total} | ${elapsed}分 | 剩余~${eta}分 | 请求${totalRequests}`);
        }

        if ((i + 1) % CONFIG.SAVE_INTERVAL === 0) {
            save();
            download();
            console.log(`  💾 进度已保存`);
        }

        await new Promise(r => setTimeout(r, CONFIG.REQUEST_INTERVAL));
    }

    save();
    download();

    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('\n🎉 采集完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 ${Object.keys(completed).length} 个社区`);
    console.log(`⏱️  ${elapsed} 分钟`);
    console.log(`❌ ${errors.length} 个错误`);
})();
