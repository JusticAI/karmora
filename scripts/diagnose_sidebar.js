/**
 * Reddit 社区侧栏数据完整诊断
 * 测试所有可能的端点，找出侧栏数据来源
 * 在 www.reddit.com 或 old.reddit.com 执行
 */
(async () => {
    const testSub = 'AskReddit';
    const BASE = location.origin;

    async function testEndpoint(name, url) {
        try {
            const resp = await fetch(url, { credentials: 'same-origin' });
            const status = resp.status;
            const text = await resp.text();
            let data;
            try { data = JSON.parse(text); } catch { data = null; }
            
            const icon = (status === 200 && data) ? '✅' : '❌';
            console.log(`${icon} ${name}: HTTP ${status}`);
            
            if (data) {
                if (Array.isArray(data)) {
                    console.log(`   数组, ${data.length} 条`);
                    if (data.length > 0) console.log(`   首条字段: ${Object.keys(data[0]).join(', ')}`);
                } else if (data.data) {
                    const keys = Object.keys(data.data);
                    console.log(`   字段数: ${keys.length}`);
                    console.log(`   字段: ${keys.join(', ')}`);
                } else {
                    console.log(`   顶层字段: ${Object.keys(data).join(', ')}`);
                }
            } else {
                console.log(`   响应: ${text.substring(0, 150)}...`);
            }
            return data;
        } catch (e) {
            console.log(`❌ ${name}: ${e.message}`);
            return null;
        }
    }

    console.log(`🔍 Reddit 社区侧栏数据完整诊断: r/${testSub}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 1. 基础信息
    console.log('📡 [基础信息]');
    await testEndpoint('about.json', `${BASE}/r/${testSub}/about.json`);
    await new Promise(r => setTimeout(r, 1000));

    // 2. 规则
    console.log('\n📡 [规则]');
    await testEndpoint('about/rules.json', `${BASE}/r/${testSub}/about/rules.json`);
    await new Promise(r => setTimeout(r, 1000));

    // 3. 版主
    console.log('\n📡 [版主]');
    await testEndpoint('about/moderators', `${BASE}/r/${testSub}/about/moderators.json`);
    await new Promise(r => setTimeout(r, 1000));

    // 4. Wiki 相关
    console.log('\n📡 [Wiki]');
    await testEndpoint('wiki/pages.json', `${BASE}/r/${testSub}/wiki/pages.json`);
    await new Promise(r => setTimeout(r, 1000));
    await testEndpoint('wiki/settings.json', `${BASE}/r/${testSub}/wiki/settings.json`);
    await new Promise(r => setTimeout(r, 1000));

    // 5. 社区 Widget（新版 Reddit 特有）
    console.log('\n📡 [社区 Widgets]');
    await testEndpoint('api/widgets', `${BASE}/r/${testSub}/api/widgets.json`);
    await new Promise(r => setTimeout(r, 1000));
    await testEndpoint('api/sidebar', `${BASE}/api/v1/sidebar?subreddit=${testSub}`);
    await new Promise(r => setTimeout(r, 1000));

    // 6. 社区菜单/书签
    console.log('\n📡 [社区菜单]');
    await testEndpoint('api/community_menu', `${BASE}/r/${testSub}/api/community_menu.json`);
    await new Promise(r => setTimeout(r, 1000));

    // 7. 提交要求
    console.log('\n📡 [提交要求]');
    await testEndpoint('api/submit_text', `${BASE}/r/${testSub}/api/submit_text.json`);
    await new Promise(r => setTimeout(r, 1000));

    // 8. 社区规则详情
    console.log('\n📡 [规则详情]');
    await testEndpoint('rules.json (顶层)', `${BASE}/r/${testSub}/rules.json`);
    await new Promise(r => setTimeout(r, 1000));

    // 9. 社区设置
    console.log('\n📡 [社区设置]');
    await testEndpoint('about/edit.json', `${BASE}/r/${testSub}/about/edit.json`);
    await new Promise(r => setTimeout(r, 1000));

    // 10. 相关社区
    console.log('\n📡 [相关社区]');
    await testEndpoint('api/related_subreddits', `${BASE}/r/${testSub}/api/related_subreddits.json`);
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('诊断完成！');
})();
