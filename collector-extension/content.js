/**
 * Reddit Community Collector - Content Script (支持从指定阶段开始)
 */

(async () => {
    if (window.__karmora_collector_running) return;
    window.__karmora_collector_running = true;

    const CONFIG = {
        REQUEST_INTERVAL: 4000,
        RESUME_THRESHOLD: 15,
        MAX_RETRIES: 5,
        SAVE_INTERVAL: 10,
    };

    const STAGES = {
        1: { name: '基础信息 + 规则', description: 'about.json + rules.json' },
        2: { name: '版主 + 提交指南', description: 'moderators + submit_text' },
        3: { name: 'Wiki 内容', description: 'wiki pages + content' },
    };

    // ============ 状态管理 ============
    async function loadState() {
        try {
            return await collectorDB.loadState();
        } catch (e) {
            console.log('[Collector] 加载状态失败，使用默认值:', e.message);
            return collectorDB.getDefaultState();
        }
    }

    async function saveState(state) {
        try {
            await collectorDB.saveState(state);
        } catch (e) {
            console.log('[Collector] 保存状态失败:', e.message);
        }
    }

    function sendStatus(state) {
        const stage = state.currentStage;
        const completedInStage = Object.keys(state.stageProgress[stage] || {}).length;
        const total = state.communities.length;
        
        chrome.runtime.sendMessage({
            type: 'STATUS_UPDATE',
            data: {
                currentStage: stage,
                stageName: STAGES[stage]?.name || '',
                total: total,
                completed: completedInStage,
                totalCompleted: Object.values(state.stageProgress).reduce(
                    (sum, p) => sum + Object.keys(p).length, 0
                ),
                errors: state.errors.length,
                requests: state.totalRequests,
                isRunning: state.isRunning,
                isComplete: state.isComplete,
                stageProgress: {
                    1: Object.keys(state.stageProgress[1] || {}).length,
                    2: Object.keys(state.stageProgress[2] || {}).length,
                    3: Object.keys(state.stageProgress[3] || {}).length,
                },
            }
        }).catch(() => {});
    }

    // ============ 请求函数 ============
    const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB 最大响应体大小

    async function fetchJSON(url, state) {
        for (let i = 0; i < CONFIG.MAX_RETRIES; i++) {
            try {
                const resp = await fetch(url, { credentials: 'same-origin' });
                state.totalRequests++;

                const remaining = parseFloat(resp.headers.get('x-ratelimit-remaining') || '999');
                const reset = parseFloat(resp.headers.get('x-ratelimit-reset') || '0');

                if (remaining < CONFIG.RESUME_THRESHOLD && reset > 0) {
                    const waitMs = (reset + 5) * 1000;
                    console.log(`[Collector] ⏳ 剩余 ${remaining}，等待 ${Math.ceil(waitMs / 1000)} 秒...`);
                    await new Promise(r => setTimeout(r, waitMs));
                }

                if (resp.status === 429) {
                    const retryAfter = parseInt(resp.headers.get('retry-after') || '60');
                    console.log(`[Collector] ⏳ HTTP 429，等待 ${retryAfter} 秒...`);
                    await new Promise(r => setTimeout(r, (retryAfter + 5) * 1000));
                    continue;
                }

                // 4xx 错误（除 429 外）表示资源不存在或无权限，立即抛出不重试
                if (resp.status >= 400 && resp.status < 500) {
                    throw new Error(`HTTP ${resp.status}`);
                }

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                // 检查响应大小，避免 RangeError: Invalid string length
                const contentLength = parseInt(resp.headers.get('content-length') || '0');
                if (contentLength > MAX_RESPONSE_SIZE) {
                    console.log(`[Collector] ⚠️ 响应过大 (${(contentLength / 1024 / 1024).toFixed(1)}MB)，跳过: ${url}`);
                    throw new Error('Response too large');
                }

                // 使用流式读取限制最大字节数
                let text;
                try {
                    const reader = resp.body.getReader();
                    const decoder = new TextDecoder();
                    let result = '';
                    let totalBytes = 0;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        totalBytes += value.length;
                        if (totalBytes > MAX_RESPONSE_SIZE) {
                            reader.cancel();
                            throw new Error('Response too large');
                        }
                        result += decoder.decode(value, { stream: true });
                    }
                    result += decoder.decode(); // flush
                    text = result;
                } catch (readError) {
                    if (readError.message === 'Response too large') throw readError;
                    // 如果流式读取失败，回退到 resp.text()
                    text = await resp.text();
                }

                try { return JSON.parse(text); }
                catch { throw new Error('Invalid JSON'); }

            } catch (e) {
                // 4xx 错误和响应过大错误不重试，直接抛出
                if (e.message.startsWith('HTTP 4')) throw e;
                if (e.message === 'Response too large') throw e;
                if (i === CONFIG.MAX_RETRIES - 1) throw e;
                await new Promise(r => setTimeout(r, Math.min(5000 * (i + 1), 30000)));
            }
        }
    }

    // ============ 阶段1: 基础信息 + 规则 ============
    async function collectStage1(name, state) {
        const result = { name, about: null, rules: null, collected_at: new Date().toISOString() };

        // about.json
        try {
            const data = await fetchJSON(`/r/${name}/about.json`, state);
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
            // 404 意味着 subreddit 不存在，跳过后续请求，不作为错误上报
            if (e.message.includes('404')) {
                result.not_found = true;
                return result;
            }
            // 403 意味着社区被限制/私有，不作为错误上报
            if (!e.message.includes('403')) {
                result.about_error = e.message;
            }
        }

        // 如果 about 已经出错且是 404 类型，跳过后续请求
        if (result.not_found) return result;

        await new Promise(r => setTimeout(r, CONFIG.REQUEST_INTERVAL));

        // rules.json
        try {
            const data = await fetchJSON(`/r/${name}/about/rules.json`, state);
            result.rules = (data.rules || []).map(r => ({
                short_name: r.short_name || '',
                description: r.description || '',
                violation_reason: r.violation_reason || '',
                priority: r.priority || 0,
            }));
        } catch (e) {
            // 404 对于 rules 是正常的（部分社区没有规则），不作为错误上报
            if (e.message.includes('404')) {
                result.rules = [];
            } else {
                result.rules_error = e.message;
            }
        }

        return result;
    }

    // ============ 阶段2: 版主 + 提交指南 ============
    async function collectStage2(name, state) {
        const result = { name, collected_at: new Date().toISOString() };

        try {
            const data = await fetchJSON(`/r/${name}/about/moderators.json`, state);
            result.moderators = (data.data?.children || []).map(m => ({
                name: m.name,
                mod_permissions: m.mod_permissions || [],
            }));
        } catch (e) {
            // 404/403 意味着社区不存在、无权限或被限制，不作为错误上报
            if (!e.message.includes('404') && !e.message.includes('403')) {
                result.moderators_error = e.message;
            }
        }

        await new Promise(r => setTimeout(r, CONFIG.REQUEST_INTERVAL));

        try {
            const data = await fetchJSON(`/r/${name}/api/submit_text`, state);
            result.submit_text = data.submit_text || '';
            result.submit_text_html = data.submit_text_html || '';
        } catch (e) {
            // 404/403/Invalid JSON 都是受限社区的正常响应，不作为错误上报
            if (!e.message.includes('404') && !e.message.includes('403') && !e.message.includes('Invalid JSON')) {
                result.submit_text_error = e.message;
            }
        }

        return result;
    }

    // ============ 阶段3: Wiki ============
    async function collectStage3(name, state) {
        const result = { name, collected_at: new Date().toISOString(), wiki_pages: [] };

        try {
            const data = await fetchJSON(`/r/${name}/wiki/pages.json`, state);
            const pages = data.data || [];
            result.wiki_pages = pages;

            await new Promise(r => setTimeout(r, CONFIG.REQUEST_INTERVAL));

            result.wiki_content = {};
            const pagesToCollect = pages.slice(0, 10);
            
            for (const page of pagesToCollect) {
                try {
                    const pageData = await fetchJSON(`/r/${name}/wiki/${page}.json`, state);
                    result.wiki_content[page] = {
                        content: pageData.data?.content_md || '',
                        content_html: pageData.data?.content_html || '',
                    };
                } catch (e) {
                    // 404/403 不记录为错误（wiki 页面可能不存在或被限制）
                    if (e.message.includes('404') || e.message.includes('403')) {
                        result.wiki_content[page] = { content: '', content_html: '' };
                    } else {
                        result.wiki_content[page] = { error: e.message };
                    }
                }
                await new Promise(r => setTimeout(r, CONFIG.REQUEST_INTERVAL));
            }
        } catch (e) {
            // 404/403/503 不记录为错误（资源不存在/无权限/临时服务不可用）
            if (!e.message.includes('404') && !e.message.includes('403') && !e.message.includes('503')) {
                result.wiki_pages_error = e.message;
            }
        }

        return result;
    }

    // ============ 采集单个社区（根据阶段） ============
    async function collectCommunity(name, stage, state) {
        switch (stage) {
            case 1: return collectStage1(name, state);
            case 2: return collectStage2(name, state);
            case 3: return collectStage3(name, state);
            default: throw new Error(`不支持的阶段: ${stage}`);
        }
    }

    // ============ 下载结果 ============
    function downloadResults(state, stage) {
        const stageData = state.stageProgress[stage] || {};
        const output = {
            meta: {
                collected_at: new Date().toISOString(),
                stage: stage,
                stage_name: STAGES[stage]?.name || '',
                total_requests: state.totalRequests,
                total_communities: Object.keys(stageData).length,
                errors: state.errors.filter(e => e.stage === stage).length,
            },
            communities: Object.values(stageData)
        };
        const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reddit_community_stage${stage}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function downloadAllResults(state) {
        const allCommunities = {};
        
        // 先从 communities 列表初始化所有社区（确保不丢数据）
        for (const c of state.communities) {
            allCommunities[c.name] = { name: c.name };
        }
        
        // 再合并各阶段的采集结果
        for (let s = 1; s <= 3; s++) {
            for (const [name, data] of Object.entries(state.stageProgress[s] || {})) {
                if (!allCommunities[name]) {
                    allCommunities[name] = { name };
                }
                Object.assign(allCommunities[name], data);
            }
        }
        
        // 计算各阶段完成率
        const total = state.communities.length;
        const stage1Done = Object.keys(state.stageProgress[1] || {}).length;
        const stage2Done = Object.keys(state.stageProgress[2] || {}).length;
        const stage3Done = Object.keys(state.stageProgress[3] || {}).length;
        
        const output = {
            meta: {
                collected_at: new Date().toISOString(),
                total_communities: total,
                completed_communities: {
                    stage1: stage1Done,
                    stage2: stage2Done,
                    stage3: stage3Done,
                },
                total_requests: state.totalRequests,
                stages: {
                    1: `${stage1Done}/${total} (${(stage1Done/total*100).toFixed(1)}%)`,
                    2: `${stage2Done}/${total} (${(stage2Done/total*100).toFixed(1)}%)`,
                    3: `${stage3Done}/${total} (${(stage3Done/total*100).toFixed(1)}%)`,
                }
            },
            communities: Object.values(allCommunities)
        };
        const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reddit_community_all_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============ 数据质量检查 ============
    async function checkDataQuality(state) {
        const report = {
            total: state.communities.length,
            stage1Completed: Object.keys(state.stageProgress[1] || {}).length,
            stage2Completed: Object.keys(state.stageProgress[2] || {}).length,
            stage3Completed: Object.keys(state.stageProgress[3] || {}).length,
            issues: [],
            recommendations: [],
        };

        // 检查阶段1数据质量
        const stage1Data = state.stageProgress[1] || {};
        let missingAbout = 0;
        let missingRules = 0;
        let nsfwCount = 0;
        let lowSubscribers = 0;
        let archivedCount = 0;
        let privateCount = 0;
        let notFoundCount = 0;

        for (const [name, data] of Object.entries(stage1Data)) {
            if (!data.about) {
                if (data.not_found) {
                    notFoundCount++;
                } else {
                    missingAbout++;
                }
            } else {
                if (data.about.subscribers < 100) lowSubscribers++;
                if (data.about.over18) nsfwCount++;
                if (data.about.subreddit_type === 'archived') archivedCount++;
                if (data.about.subreddit_type === 'private') privateCount++;
            }
            if (!data.rules || data.rules.length === 0) missingRules++;
        }

        // 生成报告
        if (notFoundCount > 0) {
            report.issues.push(`🚫 ${notFoundCount} 个社区已不存在 (404)`);
        }
        if (missingAbout > 0) {
            report.issues.push(`⚠️ ${missingAbout} 个社区缺少 about 数据`);
        }
        if (missingRules > 0) {
            report.issues.push(`⚠️ ${missingRules} 个社区没有规则`);
        }
        if (nsfwCount > 0) {
            report.issues.push(`🔞 ${nsfwCount} 个社区是 NSFW`);
        }
        if (lowSubscribers > 0) {
            report.issues.push(`📉 ${lowSubscribers} 个社区订阅数 < 100`);
        }
        if (archivedCount > 0) {
            report.issues.push(`📦 ${archivedCount} 个社区已归档`);
        }
        if (privateCount > 0) {
            report.issues.push(`🔒 ${privateCount} 个社区是私有的`);
        }

        // 生成建议
        if (report.stage1Completed < report.total) {
            report.recommendations.push(`建议先完成阶段1 (${report.stage1Completed}/${report.total})`);
        }
        if (lowSubscribers > 100) {
            report.recommendations.push(`考虑过滤掉订阅数 < 100 的社区`);
        }
        if (archivedCount > 10) {
            report.recommendations.push(`考虑跳过已归档的社区`);
        }

        report.qualityScore = Math.max(0, 100 - 
            (missingAbout * 2) - 
            (missingRules * 1) - 
            (archivedCount * 5) - 
            (privateCount * 3)
        );

        return report;
    }

    // ============ 主采集循环 ============
    async function runStage(stage, state) {
        let pending = state.communities.filter(c => !state.stageProgress[stage]?.[c.name]);
        
        // 阶段2/3：跳过阶段1中 404（not_found）的社区
        if (stage > 1) {
            const before = pending.length;
            pending = pending.filter(c => !state.stageProgress[1]?.[c.name]?.not_found);
            const skipped = before - pending.length;
            if (skipped > 0) {
                console.log(`[Collector] ⏭️ 跳过 ${skipped} 个 404 社区（阶段1已标记不存在）`);
            }
        }
        
        if (pending.length === 0) {
            console.log(`[Collector] 阶段${stage} 已完成`);
            return true;
        }

        console.log(`[Collector] 🚀 开始阶段${stage}: ${STAGES[stage].name}`);
        console.log(`[Collector] 📊 待采集: ${pending.length} 个社区`);

        const startTime = Date.now();
        let consecutiveErrors = 0;
        const MAX_CONSECUTIVE_ERRORS = 10;

        for (let i = 0; i < pending.length; i++) {
            const currentState = await loadState();
            if (!currentState.isRunning) {
                console.log('[Collector] ⏹️ 已停止');
                return false;
            }

            const name = pending[i].name;

            try {
                const result = await collectCommunity(name, stage, state);
                state.stageProgress[stage][name] = result;
                consecutiveErrors = 0; // 重置连续错误计数
                
                const hasError = Object.keys(result).some(k => k.endsWith('_error'));
                // not_found 的社区（404）不作为错误上报，只是数据缺失
                // 另外过滤掉所有子错误都是 404 的情况
                const errDetails = Object.entries(result)
                    .filter(([k]) => k.endsWith('_error'))
                    .map(([k, v]) => `${k}: ${v}`);
                const allErrorsAre404 = errDetails.length > 0 &&
                    errDetails.every(e => e.includes('404'));
                const allErrorsAre403 = errDetails.length > 0 &&
                    errDetails.every(e => e.includes('403'));
                if (hasError && !result.not_found && !allErrorsAre404 && !allErrorsAre403) {
                    state.errors.push({ name, stage, errors: errDetails });
                    // 通知 errorMonitor 触发文件保存
                    if (window.errorMonitor) {
                        window.errorMonitor.captureError('collector_partial', `${name}: ${errDetails.join(', ')}`);
                    }
                }
            } catch (e) {
                state.errors.push({ name, stage, error: e.message });
                console.log(`[Collector] ❌ "${name}": ${e.message}`);
                // 通知 errorMonitor 触发文件保存
                if (window.errorMonitor) {
                    window.errorMonitor.captureError('collector_error', `${name}: ${e.message}`);
                }
                consecutiveErrors++;

                // 连续错误过多，自动暂停并保存进度
                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    console.log(`[Collector] ⚠️ 连续 ${consecutiveErrors} 个错误，自动暂停`);
                    state.isRunning = false;
                    await saveState(state);
                    sendStatus(state);
                    return false;
                }
            }

            const done = Object.keys(state.stageProgress[stage]).length;
            const total = state.communities.length;
            if ((i + 1) % 10 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
                const eta = ((total - done) * 4 / 60).toFixed(0);
                console.log(`[Collector] 📊 阶段${stage} ${done}/${total} | ${elapsed}分 | 剩余~${eta}分`);
            }

            if ((i + 1) % CONFIG.SAVE_INTERVAL === 0) {
                await saveState(state);
                sendStatus(state);
                console.log(`[Collector] 💾 进度已保存`);
            }

            await new Promise(r => setTimeout(r, CONFIG.REQUEST_INTERVAL));
        }

        downloadResults(state, stage);
        console.log(`[Collector] ✅ 阶段${stage} 完成!`);
        return true;
    }

    async function runCollector(startStage) {
        let state = await loadState();

        if (!state.communities || state.communities.length === 0) {
            console.log('[Collector] 无社区数据，请先在 popup 中加载数据');
            return;
        }

        state.isRunning = true;
        state.startStage = startStage;
        state.currentStage = startStage;
        state.startTime = state.startTime || Date.now();
        await saveState(state);
        sendStatus(state);

        // 从指定阶段开始，依次执行到阶段3
        for (let stage = startStage; stage <= 3; stage++) {
            state.currentStage = stage;
            await saveState(state);
            sendStatus(state);

            const stageComplete = await runStage(stage, state);
            
            if (!stageComplete) {
                state.isRunning = false;
                await saveState(state);
                sendStatus(state);
                return;
            }

            if (stage < 3) {
                console.log(`[Collector] 🔄 自动开始阶段${stage + 1}...`);
                await new Promise(r => setTimeout(r, 5000));
            }
        }

        state.isRunning = false;
        state.isComplete = true;
        await saveState(state);
        sendStatus(state);

        const elapsed = ((Date.now() - state.startTime) / 1000 / 60 / 60).toFixed(1);
        console.log(`[Collector] 🎉 全部完成! 总耗时 ${elapsed} 小时`);
    }

    // ============ 消息监听 ============
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'START_COLLECTOR') {
            const startStage = message.startStage || 2; // 默认从阶段2开始
            runCollector(startStage);
            sendResponse({ success: true });
        } else if (message.type === 'CHECK_QUALITY') {
            loadState().then(async (state) => {
                const report = await checkDataQuality(state);
                sendResponse({ success: true, report });
            });
            return true;
        } else if (message.type === 'GET_ERROR_REPORT') {
            if (window.errorMonitor) {
                window.errorMonitor.loadErrors().then(() => {
                    sendResponse({ 
                        success: true, 
                        report: window.errorMonitor.generateReport(),
                        summary: window.errorMonitor.getErrorSummary(),
                    });
                });
            } else {
                sendResponse({ success: false, error: 'errorMonitor not loaded' });
            }
            return true;
        } else if (message.type === 'MARK_ERROR_FIXED') {
            const { fingerprint } = message;
            if (fingerprint && window.errorMonitor) {
                window.errorMonitor.markAsFixed(fingerprint);
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'Missing fingerprint' });
            }
            return true;
        } else if (message.type === 'STOP_COLLECTOR') {
            loadState().then(state => {
                state.isRunning = false;
                saveState(state).then(() => sendResponse({ success: true }));
            });
            return true;
        } else if (message.type === 'GET_STATUS') {
            loadState().then(state => {
                sendResponse({
                    currentStage: state.currentStage,
                    stageName: STAGES[state.currentStage]?.name || '',
                    total: state.communities.length,
                    completed: Object.keys(state.stageProgress[state.currentStage] || {}).length,
                    totalCompleted: Object.values(state.stageProgress).reduce(
                        (sum, p) => sum + Object.keys(p).length, 0
                    ),
                    errors: state.errors.length,
                    requests: state.totalRequests,
                    isRunning: state.isRunning,
                    isComplete: state.isComplete,
                    stageProgress: {
                        1: Object.keys(state.stageProgress[1] || {}).length,
                        2: Object.keys(state.stageProgress[2] || {}).length,
                        3: Object.keys(state.stageProgress[3] || {}).length,
                    },
                });
            });
            return true;
        } else if (message.type === 'DOWNLOAD_ALL') {
            loadState().then(state => {
                downloadAllResults(state);
                sendResponse({ success: true });
            });
            return true;
        } else if (message.type === 'RESET') {
            collectorDB.clearState().then(() => {
                sendResponse({ success: true });
            }).catch(e => {
                sendResponse({ success: false, error: e.message });
            });
            return true;
        }
    });

    console.log('[Collector] 多阶段采集器已加载（支持从指定阶段开始）');

    // ============ 初始化：如果 state 为空，自动加载内置社区列表 ============
    (async () => {
        try {
            const state = await loadState();

            // 迁移旧数据：从 chrome.storage.local 迁移到 IndexedDB
            if (!state.communities || state.communities.length === 0) {
                const oldData = await new Promise(resolve => {
                    chrome.storage.local.get(['collector_state'], result => {
                        resolve(result.collector_state || null);
                    });
                });

                if (oldData && oldData.communities && oldData.communities.length > 0) {
                    console.log(`[Collector] 📦 迁移旧数据: ${oldData.communities.length} 个社区`);
                    await saveState(oldData);
                    // 清除旧数据
                    chrome.storage.local.remove('collector_state');
                    console.log('[Collector] ✅ 迁移完成');
                }
            }

            // 重新加载状态
            const freshState = await loadState();
            if ((!freshState.communities || freshState.communities.length === 0) && typeof COMMUNITY_LIST !== 'undefined') {
                freshState.communities = COMMUNITY_LIST.map(name => ({ name }));
                await saveState(freshState);
                console.log(`[Collector] 📋 已加载内置社区列表: ${COMMUNITY_LIST.length} 个`);
            }
        } catch (e) {
            console.log('[Collector] 初始化失败:', e.message);
        }
    })();

    // ============ 自动恢复：页面加载时检查是否需要继续采集 ============
    (async () => {
        try {
            const state = await loadState();
            // 检查是否需要恢复采集（正在运行 或 因连续错误暂停）
            const shouldResume = state.isRunning || 
                (state.errors && state.errors.length > 0 && !state.isComplete);

            if (shouldResume && state.communities && state.communities.length > 0) {
                console.log(`[Collector] 🔄 检测到未完成的采集任务，自动恢复...`);
                console.log(`[Collector] 📊 阶段${state.currentStage} 进度: ${Object.keys(state.stageProgress[state.currentStage] || {}).length}/${state.communities.length}`);
                // 等待页面稳定后恢复
                await new Promise(r => setTimeout(r, 3000));
                const freshState = await loadState();
                if (freshState.isRunning || shouldResume) {
                    // 标记为运行状态
                    freshState.isRunning = true;
                    await saveState(freshState);
                    runCollector(freshState.currentStage);
                }
            }
        } catch (e) {
            console.log('[Collector] 自动恢复检查失败:', e.message);
        }
    })();
})();
