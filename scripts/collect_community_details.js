/**
 * Reddit 社区详情采集脚本 - 阶段1
 * 采集 about.json + rules.json
 * 
 * 在 www.reddit.com 的 Console 中执行
 * 
 * 特性：
 * - 自动保存进度到 localStorage，中断后可继续
 * - 监控限流头，动态等待
 * - 失败自动重试，不跳过
 * - 每 50 个社区自动下载中间结果
 * 
 * 预计耗时：~12 小时（5539 社区 × 2 请求 × 4秒/请求）
 */

(async () => {
    // ============ 配置 ============
    const CONFIG = {
        REQUEST_INTERVAL: 4000,       // 请求间隔 4 秒
        RESUME_THRESHOLD: 15,         // remaining 低于此值时等待重置
        MAX_RETRIES: 5,               // 最大重试次数
        SAVE_INTERVAL: 50,            // 每 N 个社区保存一次进度
        PROGRESS_KEY: 'karmora_collect_progress',  // localStorage key
    };

    // ============ 状态恢复 ============
    let state = {
        completed: {},    // { communityName: { about, rules } }
        errors: [],       // 错误记录
        totalRequests: 0,
        startTime: Date.now(),
    };

    // 尝试从 localStorage 恢复进度
    try {
        const saved = localStorage.getItem(CONFIG.PROGRESS_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            state.completed = parsed.completed || {};
            state.errors = parsed.errors || [];
            state.totalRequests = parsed.totalRequests || 0;
            console.log(`📂 恢复进度: 已完成 ${Object.keys(state.completed).length} 个社区`);
        }
    } catch {}

    // ============ 加载社区列表 ============
    let communities;
    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        communities = data.communities || data;
        console.log(`📋 从剪贴板加载: ${communities.length} 个社区`);
    } catch {
        console.log('⚠️ 无法从剪贴板读取');
        console.log('请先复制 reddit_communities_v7_enriched_*.json 的内容');
        console.log('然后重新运行本脚本');
        return;
    }

    // 过滤已采集的
    const pending = communities.filter(c => !state.completed[c.name]);
    console.log(`📊 待采集: ${pending.length} 个 (已完成 ${Object.keys(state.completed).length} 个)`);

    if (pending.length === 0) {
        console.log('✅ 全部已完成！');
        return;
    }

    // ============ 请求函数 ============
    async function fetchJSON(url) {
        for (let i = 0; i < CONFIG.MAX_RETRIES; i++) {
            try {
                const resp = await fetch(url, { credentials: 'same-origin' });
                state.totalRequests++;

                // 读取限流头
                const remaining = parseFloat(resp.headers.get('x-ratelimit-remaining') || '999');
                const reset = parseFloat(resp.headers.get('x-ratelimit-reset') || '0');

                // 动态等待
                if (remaining < CONFIG.RESUME_THRESHOLD && reset > 0) {
                    const waitMs = (reset + 5) * 1000;
                    console.log(`  ⏳ 剩余 ${remaining}，等待 ${Math.ceil(waitMs / 1000)} 秒...`);
                    await new Promise(r => setTimeout(r, waitMs));
                }

                // 429 限流
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
                const wait = Math.min(5000 * (i + 1), 30000);
                console.log(`  ⚠️ 重试 ${i + 1}: ${e.message}，等 ${wait / 1000} 秒`);
                await new Promise(r => setTimeout(r, wait));
            }
        }
    }

    // ============ 采集单个社区 ============
    async function collectCommunity(name) {
        const result = { name, about: null, rules: null, collected_at: new Date().toISOString() };

        // 采集 about.json
        try {
            const aboutData = await fetchJSON(`/r/${name}/about.json`);
            const d = aboutData.data;
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
                header_img: d.header_img || '',
                key_color: d.key_color || '',
                url: d.url || '',
            };
        } catch (e) {
            result.about_error = e.message;
        }

        await new Promise(r => setTimeout(r, CONFIG.REQUEST_INTERVAL));

        // 采集 rules.json
        try {
            const rulesData = await fetchJSON(`/r/${name}/about/rules.json`);
            result.rules = (rulesData.rules || []).map(r => ({
                short_name: r.short_name || '',
                description: r.description || '',
                violation_reason: r.violation_reason || '',
                priority: r.priority || 0,
                description_html: r.description_html || '',
            }));
        } catch (e) {
            result.rules_error = e.message;
        }

        return result;
    }

    // ============ 保存进度 ============
    function saveProgress() {
        try {
            localStorage.setItem(CONFIG.PROGRESS_KEY, JSON.stringify({
                completed: state.completed,
                errors: state.errors,
                totalRequests: state.totalRequests,
            }));
        } catch (e) {
            console.log(`  ⚠️ 保存进度失败: ${e.message}`);
        }
    }

    // ============ 下载结果 ============
    function downloadResults(suffix = '') {
        const communities = Object.values(state.completed);
        const elapsed = ((Date.now() - state.startTime) / 1000 / 60).toFixed(1);

        const output = {
            meta: {
                collected_at: new Date().toISOString(),
                elapsed_minutes: parseFloat(elapsed),
                total_requests: state.totalRequests,
                total_communities: communities.length,
                errors: state.errors.length,
            },
            communities: communities
        };

        const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reddit_community_details${suffix}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============ 主循环 ============
    console.log('🚀 开始采集社区详情 (阶段1: about + rules)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`限流: 1请求/4秒 | 进度每${CONFIG.SAVE_INTERVAL}个社区保存\n`);

    for (let i = 0; i < pending.length; i++) {
        const community = pending[i];
        const name = community.name;

        try {
            const result = await collectCommunity(name);
            state.completed[name] = result;

            // 检查是否有错误
            if (result.about_error || result.rules_error) {
                state.errors.push({
                    name,
                    about_error: result.about_error,
                    rules_error: result.rules_error,
                    time: new Date().toISOString()
                });
            }

        } catch (e) {
            state.errors.push({
                name,
                error: e.message,
                time: new Date().toISOString()
            });
            console.log(`  ❌ "${name}": ${e.message}`);
        }

        // 进度报告
        const done = Object.keys(state.completed).length;
        const total = communities.length;
        const elapsed = ((Date.now() - state.startTime) / 1000 / 60).toFixed(1);
        const rate = done / (elapsed || 1);
        const remaining = (total - done) / rate;

        if ((i + 1) % 10 === 0) {
            console.log(`  📊 ${done}/${total} | ${elapsed}分 | 剩余~${remaining.toFixed(0)}分 | 请求${state.totalRequests} | 错误${state.errors.length}`);
        }

        // 定期保存进度
        if ((i + 1) % CONFIG.SAVE_INTERVAL === 0) {
            saveProgress();
            downloadResults(`_partial`);
            console.log(`  💾 进度已保存 & 中间结果已下载`);
        }

        // 请求间隔
        await new Promise(r => setTimeout(r, CONFIG.REQUEST_INTERVAL));
    }

    // ============ 完成 ============
    saveProgress();
    downloadResults();

    const elapsed = ((Date.now() - state.startTime) / 1000 / 60).toFixed(1);
    const done = Object.keys(state.completed).length;

    console.log('\n🎉 采集完成!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 社区总数: ${done}`);
    console.log(`📡 总请求数: ${state.totalRequests}`);
    console.log(`⏱️  总耗时: ${elapsed} 分钟`);
    console.log(`❌ 错误数: ${state.errors.length}`);
    console.log(`📁 文件已自动下载`);

    if (state.errors.length > 0) {
        console.log(`\n⚠️ 错误社区:`);
        state.errors.forEach(e => console.log(`  - ${e.name}: ${e.error || e.about_error || e.rules_error}`));
    }
})();
