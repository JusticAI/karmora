#!/usr/bin/env python3
"""
Supabase 数据导入脚本
导入 Reddit 社区数据到 Supabase
"""

import json
import uuid
import urllib.request
import urllib.error
import time
import sys

# ============ 配置 ============
SUPABASE_URL = 'https://hglgjtmasverfapdnwsh.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhnbGdqdG1hc3ZlcmZhcGRud3NoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzUzMjcxMiwiZXhwIjoyMDkzMTA4NzEyfQ.1HDPjlDAJxvzxTP8ewgqV7gePy9BB4huyjbKbaD6-5M'
DATA_FILE = '/Users/clawuser/Downloads/reddit_communities_v7_enriched_2026-04-30.json'
BATCH_SIZE = 500  # 每批插入数量

# ============ 辅助函数 ============
def get_badge(subs):
    if subs >= 100000:
        return 'excellent'
    elif subs >= 10000:
        return 'good'
    elif subs >= 1000:
        return 'fair'
    else:
        return 'low'

def transform_community(c):
    """转换数据格式为 Supabase schema"""
    subs = c.get('subscribers', 0) or 0
    return {
        'id': str(uuid.uuid4()),
        'name': c['name'],
        'title': c.get('title', ''),
        'description': c.get('description', ''),
        'subscribers': subs,
        'active_users': c.get('active_users', 0) or 0,
        'over18': c.get('over18', False),
        'subreddit_type': c.get('subreddit_type', 'public') or 'public',
        'category': 'unknown',
        'badge': get_badge(subs),
        'lang': 'en',
        'created_utc': c.get('created_utc', 0) or 0,
        'source': c.get('source', []),
        'rules_count': 0,
        'has_wiki': False
    }

def insert_batch(batch, batch_num):
    """插入一批数据到 Supabase"""
    url = f'{SUPABASE_URL}/rest/v1/communities'
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }
    
    data = json.dumps(batch).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req) as resp:
            return True, resp.status
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else ''
        return False, f'HTTP {e.code}: {error_body[:200]}'
    except Exception as e:
        return False, str(e)

# ============ 主流程 ============
def main():
    print('🚀 Reddit 社区数据导入 Supabase')
    print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    
    # 加载数据
    print(f'📂 加载数据: {DATA_FILE}')
    with open(DATA_FILE, 'r') as f:
        data = json.load(f)
    
    communities = data['communities']
    total = len(communities)
    print(f'📊 社区总数: {total}\n')
    
    # 转换格式
    print('🔄 转换数据格式...')
    records = [transform_community(c) for c in communities]
    print(f'✅ 转换完成: {len(records)} 条\n')
    
    # 分批插入
    batches = [records[i:i+BATCH_SIZE] for i in range(0, len(records), BATCH_SIZE)]
    print(f'📦 分批插入: {len(batches)} 批 (每批 {BATCH_SIZE} 条)\n')
    
    success_count = 0
    error_count = 0
    start_time = time.time()
    
    for i, batch in enumerate(batches):
        ok, result = insert_batch(batch, i+1)
        
        if ok:
            success_count += len(batch)
            elapsed = time.time() - start_time
            rate = success_count / elapsed if elapsed > 0 else 0
            remaining = (total - success_count) / rate if rate > 0 else 0
            print(f'  ✅ 批次 {i+1}/{len(batches)}: +{len(batch)} 条 | 总计 {success_count}/{ {total} } | 剩余 ~{remaining:.0f}秒')
        else:
            error_count += len(batch)
            print(f'  ❌ 批次 {i+1}/{len(batches)}: {result}')
            
            # 如果失败，尝试逐条插入找出问题
            if 'HTTP 4' in str(result):
                print(f'     尝试逐条插入...')
                for record in batch:
                    ok2, res2 = insert_batch([record], 0)
                    if ok2:
                        success_count += 1
                        error_count -= 1
                    else:
                        print(f'     ❌ "{record["name"]}": {res2}')
        
        # 请求间隔
        if i < len(batches) - 1:
            time.sleep(0.5)
    
    elapsed = time.time() - start_time
    
    # 验证结果
    print(f'\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    print(f'🎉 导入完成!')
    print(f'  成功: {success_count}')
    print(f'  失败: {error_count}')
    print(f'  耗时: {elapsed:.1f} 秒')
    
    # 验证数据库中的数据
    print(f'\n🔍 验证数据库...')
    verify_url = f'{SUPABASE_URL}/rest/v1/communities?select=count'
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Prefer': 'count=exact'
    }
    req = urllib.request.Request(verify_url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            count = resp.read().decode('utf-8')
            print(f'  数据库记录数: {count}')
    except Exception as e:
        print(f'  验证失败: {e}')

if __name__ == '__main__':
    main()
