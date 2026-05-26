#!/usr/bin/env python3
"""
获取所有 Reddit 社区（26字母搜索，防封版）
"""

import json
import os
import time
import urllib.request

HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
OUTPUT_PATH = os.path.expanduser("~/reddit-karma-landing/data/all_communities.json")
PROGRESS_PATH = os.path.expanduser("~/reddit-karma-landing/data/search_progress.json")

def load_progress():
    """加载进度"""
    if os.path.exists(PROGRESS_PATH):
        with open(PROGRESS_PATH) as f:
            return json.load(f)
    return {'completed_letters': [], 'communities': []}

def save_progress(completed_letters, communities):
    """保存进度"""
    with open(PROGRESS_PATH, 'w') as f:
        json.dump({'completed_letters': completed_letters, 'communities': communities}, f)

def search_communities(query, max_pages=50):
    """搜索社区，限制页数"""
    all_communities = []
    after = None
    
    for page in range(1, max_pages + 1):
        url = f"https://www.reddit.com/subreddits/search.json?q={query}&limit=100"
        if after:
            url += f"&after={after}"
        
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode('utf-8'))
            
            children = data.get('data', {}).get('children', [])
            after = data.get('data', {}).get('after')
            
            if not children:
                break
            
            for child in children:
                d = child['data']
                all_communities.append({
                    'name': d.get('name', ''),
                    'title': d.get('title', ''),
                    'description': d.get('public_description', ''),
                    'subscribers': d.get('subscribers', 0),
                    'created_utc': d.get('created_utc', 0),
                    'lang': d.get('lang', 'en'),
                    'subreddit_type': d.get('subreddit_type', 'public'),
                    'over18': d.get('over18', False),
                })
            
            if page % 10 == 0:
                print(f"    Page {page}: {len(all_communities)} communities")
            
            if not after:
                break
            
            time.sleep(3)  # 每页间隔 3 秒
            
        except Exception as e:
            if '403' in str(e):
                print(f"    Blocked! Waiting 60 seconds...")
                time.sleep(60)
                continue
            else:
                print(f"    Error: {e}")
                time.sleep(5)
                continue
    
    return all_communities

def main():
    print("=" * 50)
    print("Karmora: Get All Reddit Communities (Safe Mode)")
    print("=" * 50)
    
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    
    # 加载进度
    progress = load_progress()
    completed_letters = progress['completed_letters']
    all_communities = progress['communities']
    
    print(f"Resuming from: {len(completed_letters)} letters completed, {len(all_communities)} communities")
    
    # 搜索词
    search_terms = list('abcdefghijklmnopqrstuvwxyz') + ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
    
    for i, term in enumerate(search_terms, 1):
        if term in completed_letters:
            continue
        
        print(f"\n[{i}/{len(search_terms)}] Searching '{term}'...")
        communities = search_communities(term, max_pages=30)  # 每个字母最多 30 页
        print(f"  Found: {len(communities)}")
        
        all_communities.extend(communities)
        completed_letters.append(term)
        
        # 保存进度
        save_progress(completed_letters, all_communities)
        
        # 每个字母间隔 10 秒
        print(f"  Waiting 10 seconds...")
        time.sleep(10)
    
    # 去重
    seen = set()
    unique_communities = []
    for c in all_communities:
        if c['name'] not in seen:
            seen.add(c['name'])
            unique_communities.append(c)
    
    # 按订阅者排序
    unique_communities.sort(key=lambda x: x['subscribers'], reverse=True)
    
    print(f"\n{'=' * 50}")
    print(f"Done!")
    print(f"  Total fetched: {len(all_communities)}")
    print(f"  Unique: {len(unique_communities)}")
    print(f"  Saved to: {OUTPUT_PATH}")
    print(f"{'=' * 50}")
    
    # 保存最终结果
    output = {
        'meta': {
            'total': len(unique_communities),
            'collected_at': time.strftime('%Y-%m-%d %H:%M:%S'),
        },
        'communities': unique_communities
    }
    
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    # 清理进度文件
    if os.path.exists(PROGRESS_PATH):
        os.remove(PROGRESS_PATH)

if __name__ == "__main__":
    main()
