/**
 * 社区数据筛选 & 转换脚本
 * 
 * 采集完成后，用这个脚本把 JSON 转成 data.js 格式
 * 在浏览器 Console 中执行（需要先加载采集结果 JSON）
 * 
 * 或者直接修改下面的 INPUT_URL 指向本地文件路径
 */

(async () => {
    // ====== 配置 ======
    const MIN_SUBSCRIBERS = 1000;      // 最低订阅数
    const EXCLUDE_NSFW = true;         // 排除 NSFW
    const EXCLUDE_PRIVATE = true;      // 排除私有社区
    const MAX_COMMUNITIES = 500;       // 最终保留数量上限

    // ====== 加载数据 ======
    // 方式1：从已下载的 JSON 文件读取（需要在 Console 中先加载）
    // 方式2：直接使用 allCommunities 变量
    
    let rawData;
    
    // 尝试从剪贴板读取
    try {
        const text = await navigator.clipboard.readText();
        rawData = JSON.parse(text);
        console.log('📋 从剪贴板加载数据成功');
    } catch {
        console.log('⚠️ 无法从剪贴板读取，请手动粘贴 JSON 数据到下方变量');
        console.log('   rawData = { communities: [...] }; 然后重新运行');
        return;
    }

    const communities = rawData.communities || rawData;
    console.log(`📊 输入: ${communities.length} 个社区`);

    // ====== 筛选 ======
    let filtered = communities.filter(c => {
        if (c.subscribers < MIN_SUBSCRIBERS) return false;
        if (EXCLUDE_NSFW && c.over18) return false;
        if (EXCLUDE_PRIVATE && c.subreddit_type === 'private') return false;
        return true;
    });

    console.log(`✅ 筛选后: ${filtered.length} 个社区 (订阅≥${MIN_SUBSCRIBERS}, 排除NSFW/私有)`);

    // ====== 分类打标 ======
    function categorize(name, desc, subs) {
        const n = (name + ' ' + desc).toLowerCase();
        
        // 电商相关
        if (/ecommerce|dropship|shopify|amazon|fba|flip|resell|mercari|poshmark|ebay/.test(n)) return 'ecommerce';
        if (/business|entrepreneur|startup|side.?hustle|passive.?income|smallbusiness|freelance/.test(n)) return 'ecommerce';
        
        // 技术/开发
        if (/programming|coding|developer|python|javascript|react|node|webdev|devops|saas|tech|software|api|github/.test(n)) return 'tech';
        if (/selfhosted|sysadmin|linux|docker|aws|cloud/.test(n)) return 'tech';
        
        // 创意/艺术
        if (/art|draw|paint|photo|music|creative|design|craft|pixel|watercolor|sketch/.test(n)) return 'creative';
        
        // 游戏
        if (/game|gaming|play|steam|nintendo|xbox|playstation|esport/.test(n)) return 'gaming';
        
        // 新闻/讨论
        if (/news|world|politic|current|today|ask|discuss|opinion|debate/.test(n)) return 'discussion';
        
        // 生活
        if (/food|cook|recipe|travel|fitness|health|pet|dog|cat|garden|home|diy/.test(n)) return 'lifestyle';
        
        // 学习
        if (/learn|study|school|college|university|education|teach|student/.test(n)) return 'education';
        
        return 'general';
    }

    function rateSubreddit(subs, active) {
        if (subs >= 1000000 && active > 10000) return 'excellent';
        if (subs >= 100000) return 'excellent';
        if (subs >= 10000) return 'good';
        if (subs >= 1000) return 'fair';
        return 'low';
    }

    // ====== 转换为 data.js 格式 ======
    const result = filtered.slice(0, MAX_COMMUNITIES).map(c => ({
        name: c.name,
        desc: c.description ? c.description.substring(0, 100) : '',
        subscribers: c.subscribers,
        active_users: c.active_users || 0,
        category: categorize(c.name, c.description || '', c.subscribers),
        badge: rateSubreddit(c.subscribers, c.active_users || 0),
        over18: c.over18 || false,
        source: c.source || []
    }));

    // ====== 生成 data.js 内容 ======
    let js = '// Reddit 社区数据库\n';
    js += `// 生成时间: ${new Date().toISOString()}\n`;
    js += `// 总计: ${result.length} 个社区\n\n`;
    js += 'const COMMUNITIES = [\n';

    for (const c of result) {
        const desc = (c.desc || '').replace(/'/g, "\\'").replace(/\n/g, ' ');
        js += `    { name: "${c.name}", desc: "${desc}", subscribers: ${c.subscribers}, active_users: ${c.active_users}, badge: "${c.badge}", category: "${c.category}" },\n`;
    }

    js += '];\n';

    // ====== 下载 ======
    const blob = new Blob([js], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_${new Date().toISOString().slice(0, 10)}.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // ====== 统计 ======
    console.log('\n🎉 转换完成!');
    console.log(`📊 输出: ${result.length} 个社区`);

    // 分类统计
    const catStats = {};
    result.forEach(c => {
        catStats[c.category] = (catStats[c.category] || 0) + 1;
    });
    console.log('\n📂 分类分布:');
    Object.entries(catStats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        console.log(`  ${cat}: ${count} 个`);
    });

    // Badge 统计
    const badgeStats = {};
    result.forEach(c => {
        badgeStats[c.badge] = (badgeStats[c.badge] || 0) + 1;
    });
    console.log('\n🏅 质量分布:');
    Object.entries(badgeStats).forEach(([badge, count]) => {
        console.log(`  ${badge}: ${count} 个`);
    });
})();
