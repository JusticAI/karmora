/**
 * Supabase 连接测试 + 数据导入脚本
 * 
 * 使用方法：
 * 1. 在浏览器 Console 中运行（需要先登录 Supabase Dashboard）
 * 2. 或者在 Node.js 环境中运行
 */

// ============ 配置 ============
const SUPABASE_URL = 'https://hglgjtmasverfapdnwsh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0ihuPggitdx0K-uQdIfNgQ_5xoxQbCk';
// 如果有 service_role key，填在这里（用于写入数据）
const SUPABASE_SERVICE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE';

// ============ 测试连接 ============
async function testConnection() {
    console.log('🔍 测试 Supabase 连接...\n');
    
    // 测试1: 基础连接
    try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        console.log(`✅ 基础连接: HTTP ${resp.status}`);
    } catch (e) {
        console.log(`❌ 基础连接失败: ${e.message}`);
        return false;
    }
    
    // 测试2: 查询 communities 表
    try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/communities?select=count`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'count=exact'
            }
        });
        const count = resp.headers.get('content-range');
        console.log(`✅ communities 表: ${count || '表不存在'}`);
    } catch (e) {
        console.log(`❌ 查询失败: ${e.message}`);
    }
    
    // 测试3: 检查表结构
    try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/communities?limit=1`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        if (resp.ok) {
            const data = await resp.json();
            console.log(`✅ 表结构正常，字段: ${Object.keys(data[0] || {}).join(', ')}`);
        } else {
            console.log(`⚠️ 表可能不存在: HTTP ${resp.status}`);
        }
    } catch (e) {
        console.log(`❌ 表结构检查失败: ${e.message}`);
    }
    
    return true;
}

// 如果在浏览器中运行，自动执行测试
if (typeof window !== 'undefined') {
    testConnection();
}
