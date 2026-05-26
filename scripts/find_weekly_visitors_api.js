/**
 * 找到 Reddit 前端获取 weekly visitors 的内部 API
 * 
 * 方法：打开社区页面，监听所有网络请求，找包含 "visitor" 或 "contribution" 的响应
 * 在 www.reddit.com/r/AskReddit 的 Console 中执行
 */

// 方法1：拦截 fetch 请求
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    
    // 检查是否是社区相关请求
    if (url && (url.includes('subreddit') || url.includes('community') || url.includes('sidebar'))) {
        try {
            const clone = response.clone();
            const text = await clone.text();
            if (text.includes('visitor') || text.includes('contribution') || text.includes('weekly')) {
                console.log(`🎯 找到! URL: ${url}`);
                console.log(`   响应前200字符: ${text.substring(0, 200)}`);
            }
        } catch {}
    }
    return response;
};

console.log('🔍 fetch 拦截器已启动');
console.log('请刷新页面，然后查看是否有 🎯 标记的请求');
console.log('');
console.log('或者手动检查以下可能的端点：');

// 方法2：直接测试可能的端点
(async () => {
    const sub = 'AskReddit';
    const endpoints = [
        // 可能的内部 API
        `/r/${sub}/about.json`,
        `/r/${sub}.json`,
        `/r/${sub}/hot.json?limit=1`,
        `/api/subreddit_about/${sub}`,
        `/api/v1/subreddit/${sub}`,
        `/svc/subreddit/${sub}`,
        `/r/${sub}/api/info`,
        `/r/${sub}/about/structured`,
        `/r/${sub}/about/stats`,
        `/r/${sub}/traffic.json`,
        `/r/${sub}/about/traffic`,
    ];
    
    for (const ep of endpoints) {
        try {
            const resp = await fetch(ep, { credentials: 'same-origin' });
            const text = await resp.text();
            const hasVisitors = text.includes('visitor') || text.includes('weekly');
            const icon = hasVisitors ? '🎯' : (resp.ok ? '✅' : '❌');
            console.log(`${icon} ${ep}: HTTP ${resp.status} ${hasVisitors ? '(含visitor数据!)' : ''}`);
            if (hasVisitors) {
                // 找到包含 visitor 的上下文
                const idx = text.indexOf('visitor');
                console.log(`   上下文: ...${text.substring(Math.max(0, idx - 50), idx + 80)}...`);
            }
        } catch (e) {
            console.log(`❌ ${ep}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 500));
    }
})();
