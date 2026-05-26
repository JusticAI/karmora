/**
 * Reddit 社区详情采集诊断
 * 测试各个端点返回什么数据
 * 在 www.reddit.com 或 old.reddit.com 的 Console 中执行
 */
(async () => {
    const testSub = 'AskReddit';  // 用一个大社区测试
    const BASE = location.origin;  // 自动适配新版/旧版
    
    console.log(`🔍 测试社区: r/${testSub}\n`);
    
    // 测试1: about.json
    console.log('📡 [1] /r/{sub}/about.json');
    try {
        const resp = await fetch(`/r/${testSub}/about.json`, { credentials: 'same-origin' });
        const data = await resp.json();
        const d = data.data;
        console.log('  ✅ 字段:');
        console.log(`     display_name: ${d.display_name}`);
        console.log(`     title: ${d.title}`);
        console.log(`     public_description: ${d.public_description?.substring(0, 100)}`);
        console.log(`     description: ${d.description?.substring(0, 100)}...`);
        console.log(`     subscribers: ${d.subscribers}`);
        console.log(`     accounts_active: ${d.accounts_active}`);
        console.log(`     created_utc: ${d.created_utc}`);
        console.log(`     over18: ${d.over18}`);
        console.log(`     subreddit_type: ${d.subreddit_type}`);
        console.log(`     lang: ${d.lang}`);
        console.log(`     wls: ${d.wls}`);
        console.log(`     subreddit_type: ${d.subreddit_type}`);
        // 检查是否有 weekly visitors 等字段
        const extraFields = ['weekly_visitors', 'weekly_contributions', 'active_user_count', 'accounts_active_is_fuzzed'];
        for (const f of extraFields) {
            if (d[f] !== undefined) console.log(`     ${f}: ${d[f]}`);
        }
    } catch (e) {
        console.log(`  ❌ ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 测试2: about/rules.json
    console.log('\n📡 [2] /r/{sub}/about/rules.json');
    try {
        const resp = await fetch(`/r/${testSub}/about/rules.json`, { credentials: 'same-origin' });
        const data = await resp.json();
        console.log(`  ✅ 规则数: ${data.rules?.length || 0}`);
        if (data.rules?.length > 0) {
            const first = data.rules[0];
            console.log('  第一条规则字段:');
            console.log(`     short_name: ${first.short_name}`);
            console.log(`     description: ${first.description?.substring(0, 100)}`);
            console.log(`     violation_reason: ${first.violation_reason}`);
            console.log(`     created_utc: ${first.created_utc}`);
            console.log(`     priority: ${first.priority}`);
            // 检查其他字段
            const otherKeys = Object.keys(first).filter(k => !['short_name', 'description', 'violation_reason', 'created_utc', 'priority'].includes(k));
            console.log(`     其他字段: ${otherKeys.join(', ')}`);
        }
        // 检查顶层其他字段
        const topKeys = Object.keys(data).filter(k => k !== 'rules');
        console.log(`  顶层其他字段: ${topKeys.join(', ')}`);
    } catch (e) {
        console.log(`  ❌ ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 测试3: sidebar (旧版)
    console.log('\n📡 [3] /r/{sub}/about.json 中的 description_html');
    try {
        const resp = await fetch(`/r/${testSub}/about.json`, { credentials: 'same-origin' });
        const data = await resp.json();
        const d = data.data;
        console.log(`  ✅ description_html: ${d.description_html?.substring(0, 200)}...`);
        console.log(`  ✅ public_description: ${d.public_description?.substring(0, 200)}`);
        console.log(`  ✅ submit_text: ${d.submit_text?.substring(0, 100)}`);
        console.log(`  ✅ submit_text_html: ${d.submit_text_html?.substring(0, 100)}`);
    } catch (e) {
        console.log(`  ❌ ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 测试4: 检查 wiki 页面
    console.log('\n📡 [4] /r/{sub}/wiki/pages (wiki 页面列表)');
    try {
        const resp = await fetch(`/r/${testSub}/wiki/pages.json`, { credentials: 'same-origin' });
        const data = await resp.json();
        const pages = data.data?.pages || [];
        console.log(`  ✅ Wiki 页面数: ${pages.length}`);
        if (pages.length > 0) {
            console.log(`  前5页: ${pages.slice(0, 5).join(', ')}`);
        }
    } catch (e) {
        console.log(`  ❌ ${e.message}`);
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // 测试5: 检查是否有 weekly_visitors 等统计数据
    console.log('\n📡 [5] /r/{sub}/about.json 全部字段检查');
    try {
        const resp = await fetch(`/r/${testSub}/about.json`, { credentials: 'same-origin' });
        const data = await resp.json();
        const d = data.data;
        const allKeys = Object.keys(d);
        console.log(`  总字段数: ${allKeys.length}`);
        console.log(`  所有字段: ${allKeys.join(', ')}`);
    } catch (e) {
        console.log(`  ❌ ${e.message}`);
    }
})();
